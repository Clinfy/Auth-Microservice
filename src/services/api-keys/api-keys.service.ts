import { HttpStatus, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';
import { ApiKeyEntity } from 'src/entities/api-key.entity';
import { CreateApiKeyDTO } from 'src/interfaces/DTO/api-key.dto';
import { PermissionsService } from 'src/services/permissions/permissions.service';
import { RequestWithApiKey } from 'src/interfaces/request-api-key';
import { extractApiKey } from 'src/common/utils/extract-api-key.util';
import { RequestWithUser } from 'src/interfaces/request-user';
import { ApiKeyErrorCodes, ApiKeyException } from 'src/services/api-keys/api-keys.exception.handler';
import { ApiKeysRepository } from 'src/services/api-keys/api-keys.repository';
import { RedisService } from 'src/common/redis/redis.service';
import { PaginatedResponseDto, PaginationQueryDto } from 'src/interfaces/DTO/pagination.dto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { serializeError } from 'src/common/utils/logger-format.util';
import { ApiCache } from 'src/interfaces/api-cache.interface';
import { AssignPermissionDTO } from 'src/interfaces/DTO/assign.dto';

@Injectable()
export class ApiKeysService implements OnModuleInit {
  constructor(
    private readonly apiKeysRepository: ApiKeysRepository,

    @InjectDataSource()
    private readonly dataSource: DataSource,

    private readonly permissionService: PermissionsService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,

    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.warmUpCache();
    } catch (error) {
      this.logger.warn('Failed to warm up API keys cache on init', {
        context: 'ApiKeysService',
        operation: 'onModuleInit',
        error: serializeError(error),
      });
    }
  }

  async create(dto: CreateApiKeyDTO, response: RequestWithUser): Promise<{ apiKey: string; id: string; client: string }> {
    try {
      const permissions = await Promise.all(dto.permissionIds.map((id) => this.permissionService.findOne(id)));

      const plainApiKey = this.generatePlainKey();
      const fingerprint = this.computeHmac(plainApiKey);

      const apiKey = await this.dataSource.transaction(async (transactionManager) => {
        const entity = transactionManager.create(ApiKeyEntity, {
          client: dto.client,
          key_fingerprint: fingerprint,
          permissions,
          created_by: response.user,
        });

        return await transactionManager.save(entity);
      });

      return { apiKey: plainApiKey, id: apiKey.id, client: apiKey.client };
    } catch (error) {
      throw new ApiKeyException(
        'Failed to create API key',
        ApiKeyErrorCodes.API_KEY_NOT_CREATED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
        error,
      );
    }
  }

  async findAll(query: PaginationQueryDto = new PaginationQueryDto()): Promise<PaginatedResponseDto<ApiKeyEntity>> {
    try {
      const [data, total] = await this.apiKeysRepository.findAll(query);
      return new PaginatedResponseDto(data, total, query.page, query.limit);
    } catch (error) {
      throw new ApiKeyException(
        'Api keys not found',
        ApiKeyErrorCodes.API_KEY_NOT_FOUND,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
        error,
      );
    }
  }

  async findOne(id: string): Promise<ApiKeyEntity> {
    const apiKey = await this.apiKeysRepository.findOneById(id);
    if (!apiKey) {
      throw new ApiKeyException(
        `API key with id: ${id} not found`,
        ApiKeyErrorCodes.API_KEY_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }
    return apiKey;
  }

  async deactivate(id: string): Promise<{ message: string }> {
    const apiKey = await this.findOne(id);

    if (!apiKey.active) {
      throw new ApiKeyException(
        'Api Key already deactivated',
        ApiKeyErrorCodes.API_KEY_ALREADY_DEACTIVATE,
        HttpStatus.BAD_REQUEST,
      );
    }

    apiKey.active = false;
    await this.apiKeysRepository.save(apiKey);
    await this.invalidateApiKeyCache(apiKey);

    return { message: `API key ${id} ${apiKey.client} deactivated` };
  }

  async activate(id: string): Promise<{ message: string }> {
    const apiKey = await this.findOne(id);

    if (apiKey.active) {
      throw new ApiKeyException(
        'Api Key already activated',
        ApiKeyErrorCodes.API_KEY_ALREADY_ACTIVATE,
        HttpStatus.BAD_REQUEST,
      );
    }

    apiKey.active = true;
    await this.apiKeysRepository.save(apiKey);
    await this.loadApiKeyToRedis(apiKey);

    return { message: `API key ${id} ${apiKey.client} activated` };
  }

  async changePermissions(id: string, dto: AssignPermissionDTO): Promise<ApiKeyEntity> {
    try {
      const apiKey = await this.findOne(id);

      apiKey.permissions = await Promise.all(dto.permissionsIds.map((id) => this.permissionService.findOne(id)));
      await this.apiKeysRepository.save(apiKey);
      await this.invalidateApiKeyCache(apiKey);
      await this.loadApiKeyToRedis(apiKey);
      return apiKey;
    } catch (error) {
      throw new ApiKeyException(
        'Failed to change API key permissions',
        ApiKeyErrorCodes.API_KEY_PERMISSIONS_ASSIGN_FAILED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
        error,
      );
    }
  }

  async canDo(rawApiKey: RequestWithApiKey, permissionCode: string): Promise<boolean> {
    const apiKeyPermissions = await this.findActiveByPlainKey(extractApiKey(rawApiKey));
    if (!apiKeyPermissions) {
      return false;
    }
    return apiKeyPermissions.includes(permissionCode);
  }

  async findActiveByPlainKey(rawApiKey: string): Promise<string[]> {
    const fingerprint = this.computeHmac(rawApiKey);

    //Try Redis first
    try {
      const cached = await this.redis.raw.get(this.redisKey(fingerprint));
      if (cached) {
        const cache: ApiCache = JSON.parse(cached);
        return cache.permissionCodes;
      }
    } catch (error) {
      this.logger.warn('Redis error, falling back to DB', {
        context: 'ApiKeysService',
        operation: 'findActiveByPlainKey',
        error: serializeError(error),
      });
    }

    // DB fallback — O(1) indexed lookup by fingerprint
    try {
      const apiKey = await this.apiKeysRepository.findByFingerprint(fingerprint);
      if (!apiKey) {
        throw new ApiKeyException('Invalid or inactive API key', ApiKeyErrorCodes.API_KEY_NOT_FOUND, HttpStatus.NOT_FOUND);
      }

      //Backfill cache
      try {
        const cache: ApiCache = {
          client: apiKey.client,
          permissionCodes: apiKey.permissionCodes,
        };
        const multi = this.redis.raw.multi();

        multi.set(this.redisKey(fingerprint), JSON.stringify(cache));
        multi.sAdd('api_keys', fingerprint);
        await multi.exec();
      } catch {
        this.logger.debug('API key found in DB, backfilled to Redis', {
          context: 'ApiKeysService',
          operation: 'findActiveByPlainKey',
          source: 'database',
          apiKeyId: apiKey.id,
        });
      }
      return apiKey.permissionCodes;
    } catch (error) {
      this.logger.warn('DB fallback failed', {
        context: 'ApiKeysService',
        operation: 'findActiveByPlainKey',
        error: serializeError(error),
      });
      throw new ApiKeyException(
        'Failed to find the active API key',
        ApiKeyErrorCodes.API_KEY_NOT_FOUND,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
        error,
      );
    }
  }

  private generatePlainKey(): string {
    return randomBytes(32).toString('hex');
  }

  private computeHmac(plainKey: string): string {
    return createHmac('sha256', this.configService.getOrThrow<string>('HMAC_SECRET')).update(plainKey).digest('hex');
  }

  private redisKey(fingerprint: string): string {
    return `api_key:fp:${fingerprint}`;
  }

  async warmUpCache(): Promise<void> {
    try {
      const active_api_keys = await this.apiKeysRepository.findAllActive();

      if (active_api_keys.length === 0) return;

      const multi = this.redis.raw.multi();

      for (const apiKey of active_api_keys) {
        const cache: ApiCache = {
          client: apiKey.client,
          permissionCodes: apiKey.permissionCodes,
        };

        multi.set(this.redisKey(apiKey.key_fingerprint), JSON.stringify(cache));
        multi.sAdd('api_keys', apiKey.key_fingerprint);
      }
      await multi.exec();
    } catch (error) {
      this.logger.warn('Failed to warm up API keys cache', {
        context: 'ApiKeysService',
        operation: 'warmUpCache',
        error: serializeError(error),
      });
    }
  }

  private async loadApiKeyToRedis(apiKey: ApiKeyEntity): Promise<void> {
    try {
      const cache: ApiCache = {
        client: apiKey.client,
        permissionCodes: apiKey.permissionCodes,
      };
      const multi = this.redis.raw.multi();
      multi.set(this.redisKey(apiKey.key_fingerprint), JSON.stringify(cache));
      multi.sAdd('api_keys', apiKey.key_fingerprint);
      await multi.exec();
    } catch (error) {
      this.logger.warn('Failed to load API key to Redis', {
        context: 'ApiKeysService',
        operation: 'loadApiKeyToRedis',
        error: serializeError(error),
      });
    }
  }

  private async invalidateApiKeyCache(apiKey: ApiKeyEntity): Promise<void> {
    try {
      const multi = this.redis.raw.multi();
      multi.del(this.redisKey(apiKey.key_fingerprint));
      multi.sRem('api_keys', apiKey.key_fingerprint);
      await multi.exec();
    } catch (error) {
      this.logger.warn('Failed to invalidate API key cache. Pleas try again later.', {
        context: 'ApiKeysService',
        operation: 'invalidateApiKeyCache',
        error: serializeError(error),
      });

      throw new ApiKeyException(
        'Failed to invalidate the API key from cache',
        ApiKeyErrorCodes.API_KEY_CACHE_INVALIDATION_FAILED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
        error,
      );
    }
  }
}

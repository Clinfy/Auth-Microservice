import { HttpStatus, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { EndpointPermissionRulesRepository } from 'src/services/endpoint-permission-rules/endpoint-permission-rules.repository';
import { PermissionsService } from 'src/services/permissions/permissions.service';
import {
  CreateEndpointPermissionRulesDTO,
  PatchEndpointPermissionRulesDTO,
} from 'src/interfaces/DTO/endpoint-permission-rules.dto';
import { RequestWithUser } from 'src/interfaces/request-user';
import { EndpointPermissionRulesEntity } from 'src/entities/endpoint-permission-rules.entity';
import {
  EndpointPermissionRulesErrorCodes,
  EndpointPRException,
} from 'src/services/endpoint-permission-rules/endpoint-permission-rules.exception.handler';
import { AssignPermissionDTO } from 'src/interfaces/DTO/assign.dto';
import { RedisService } from 'src/common/redis/redis.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { serializeError } from 'src/common/tools/logger-format';

@Injectable()
export class EndpointPermissionRulesService implements OnModuleInit {
  constructor(
    private readonly endpointPermissionRulesRepository: EndpointPermissionRulesRepository,
    private readonly permissionsService: PermissionsService,
    private readonly redis: RedisService,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  private redisKey(endpointKeyName: string): string {
    return `epr:${endpointKeyName}`;
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.warmUpCache();
    } catch (error) {
      this.logger.warn('Failed to warm up endpoint permission rules cache on init', {
        context: 'EndpointPermissionRulesService',
        operation: 'onModuleInit',
        error: serializeError(error),
      });
    }
  }

  async warmUpCache(): Promise<void> {
    try {
      const rules = await this.endpointPermissionRulesRepository.findAllEnabled();
      if (rules.length === 0) return;

      const multi = this.redis.raw.multi();
      for (const rule of rules) {
        multi.set(this.redisKey(rule.endpoint_key_name), JSON.stringify(rule.permissionCodes));
      }
      await multi.exec();
    } catch (error) {
      this.logger.warn('Failed to warm up endpoint permission rules cache', {
        context: 'EndpointPermissionRulesService',
        operation: 'warmUpCache',
        error: serializeError(error),
      });
    }
  }

  async loadRuleToRedis(endpointKeyName: string): Promise<void> {
    try {
      const rule = await this.endpointPermissionRulesRepository.findByEndpointKey(endpointKeyName);
      if (rule?.enabled) {
        await this.redis.raw.set(this.redisKey(endpointKeyName), JSON.stringify(rule.permissionCodes));
      } else {
        await this.invalidateRuleCache(endpointKeyName);
      }
    } catch (error) {
      this.logger.warn('Failed to load rule to Redis', {
        context: 'EndpointPermissionRulesService',
        operation: 'loadRuleToRedis',
        endpointKeyName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async invalidateRuleCache(endpointKeyName: string): Promise<void> {
    try {
      await this.redis.raw.del(this.redisKey(endpointKeyName));
    } catch (error) {
      this.logger.warn('Failed to invalidate cache', {
        context: 'EndpointPermissionRulesService',
        operation: 'invalidateRuleCache',
        endpointKeyName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getPermissionsForEndpoint(endpointKey: string): Promise<string[]> {
    // Try Redis first
    try {
      const cached = await this.redis.raw.get(this.redisKey(endpointKey));
      if (cached) {
        return JSON.parse(cached) as string[];
      }
    } catch (error) {
      this.logger.warn('Redis error, falling back to DB', {
        context: 'EndpointPermissionRulesService',
        operation: 'getPermissionsForEndpoint',
        endpointKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // DB fallback
    try {
      const rule = await this.endpointPermissionRulesRepository.findByEndpointKey(endpointKey);
      if (!rule) {
        throw new EndpointPRException(
          'This endpoint does not have a permission rule defined and is temporally disabled.',
          EndpointPermissionRulesErrorCodes.ENDPOINT_PERMISSION_RULE_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }

      if (!rule.enabled) {
        throw new EndpointPRException(
          'This endpoint is temporarily disabled. Please try again later.',
          EndpointPermissionRulesErrorCodes.ENDPOINT_PERMISSION_RULE_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      const codes = rule.permissionCodes;
      // Backfill cache
      try {
        await this.redis.raw.set(this.redisKey(endpointKey), JSON.stringify(codes));
      } catch {
        /* non-blocking backfill */
      }
      return codes;
    } catch (error) {
      this.logger.warn('DB fallback failed', {
        context: 'EndpointPermissionRulesService',
        operation: 'getPermissionsForEndpoint',
        endpointKey,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async create(dto: CreateEndpointPermissionRulesDTO, request: RequestWithUser): Promise<EndpointPermissionRulesEntity> {
    try {
      const saved = await this.endpointPermissionRulesRepository.save(
        this.endpointPermissionRulesRepository.create({ ...dto, created_by: request.user }),
      );
      await this.loadRuleToRedis(saved.endpoint_key_name);
      return saved;
    } catch (error) {
      throw new EndpointPRException(
        'Endpoint Permission Rule creation failed',
        EndpointPermissionRulesErrorCodes.ENDPOINT_PERMISSION_RULE_NOT_CREATED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
        error,
      );
    }
  }

  async update(id: string, dto: PatchEndpointPermissionRulesDTO) {
    try {
      const existing = await this.findOne(id);
      const oldKeyName = existing.endpoint_key_name;
      const merged = await this.endpointPermissionRulesRepository.merge(existing, dto);
      const saved = await this.endpointPermissionRulesRepository.save(merged);

      if (dto.endpoint_key_name && dto.endpoint_key_name !== oldKeyName) {
        await this.invalidateRuleCache(oldKeyName);
        await this.loadRuleToRedis(dto.endpoint_key_name);
      } else {
        await this.loadRuleToRedis(saved.endpoint_key_name);
      }

      return saved;
    } catch (error) {
      throw new EndpointPRException(
        'Endpoint Permission Rule update failed',
        EndpointPermissionRulesErrorCodes.ENDPOINT_PERMISSION_RULE_NOT_UPDATED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
        error,
      );
    }
  }

  async delete(id: string): Promise<{ message: string }> {
    try {
      const endpointPermissionRule = await this.findOne(id);
      await this.endpointPermissionRulesRepository.remove(endpointPermissionRule);
      await this.invalidateRuleCache(endpointPermissionRule.endpoint_key_name);
      return { message: `Endpoint Permission Rule ${endpointPermissionRule.endpoint_key_name} deleted` };
    } catch (error) {
      throw new EndpointPRException(
        'Endpoint Permission Rule delete failed',
        EndpointPermissionRulesErrorCodes.ENDPOINT_PERMISSION_RULE_NOT_DELETED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
        error,
      );
    }
  }

  async findOne(id: string): Promise<EndpointPermissionRulesEntity> {
    const endpointPermissionRule = await this.endpointPermissionRulesRepository.findOneById(id);

    if (!endpointPermissionRule)
      throw new EndpointPRException(
        'Endpoint Permission Rule not found',
        EndpointPermissionRulesErrorCodes.ENDPOINT_PERMISSION_RULE_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    return endpointPermissionRule;
  }

  async findAll(): Promise<EndpointPermissionRulesEntity[]> {
    try {
      return await this.endpointPermissionRulesRepository.findAll();
    } catch (error) {
      throw new EndpointPRException(
        'Endpoint Permission Rules not found',
        EndpointPermissionRulesErrorCodes.ENDPOINT_PERMISSION_RULE_NOT_FOUND,
        error.status ?? HttpStatus.NOT_FOUND,
        error,
      );
    }
  }

  async assignPermissions(id: string, dto: AssignPermissionDTO): Promise<EndpointPermissionRulesEntity> {
    try {
      const endpointPermissionRule = await this.findOne(id);
      endpointPermissionRule.permissions = await Promise.all(
        dto.permissionsIds.map((id) => this.permissionsService.findOne(id)),
      );
      const saved = await this.endpointPermissionRulesRepository.save(endpointPermissionRule);
      await this.loadRuleToRedis(saved.endpoint_key_name);
      return saved;
    } catch (error) {
      throw new EndpointPRException(
        'Endpoint Permission Rule permission assignment failed',
        EndpointPermissionRulesErrorCodes.ENDPOINT_PERMISSION_RULE_ASSIGN_FAILED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
        error,
      );
    }
  }

  async enableRule(id: string): Promise<{ message: string }> {
    const endpointPermissionRule = await this.findOne(id);

    if (endpointPermissionRule.enabled) {
      throw new EndpointPRException(
        'Endpoint Permission Rule already enabled',
        EndpointPermissionRulesErrorCodes.ENDPOINT_PERMISSION_RULE_ALREADY_ENABLED,
        HttpStatus.BAD_REQUEST,
      );
    }
    endpointPermissionRule.enabled = true;
    await this.endpointPermissionRulesRepository.save(endpointPermissionRule);
    await this.loadRuleToRedis(endpointPermissionRule.endpoint_key_name);
    return { message: `Endpoint Permission Rule ${endpointPermissionRule.endpoint_key_name} enabled` };
  }

  async disableRule(id: string): Promise<{ message: string }> {
    const endpointPermissionRule = await this.findOne(id);

    if (!endpointPermissionRule.enabled) {
      throw new EndpointPRException(
        'Endpoint Permission Rule already disabled',
        EndpointPermissionRulesErrorCodes.ENDPOINT_PERMISSION_RULE_ALREADY_DISABLED,
        HttpStatus.BAD_REQUEST,
      );
    }
    endpointPermissionRule.enabled = false;
    await this.endpointPermissionRulesRepository.save(endpointPermissionRule);
    await this.invalidateRuleCache(endpointPermissionRule.endpoint_key_name);
    return { message: `Endpoint Permission Rule ${endpointPermissionRule.endpoint_key_name} disabled` };
  }
}

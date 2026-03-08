import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcrypt';
import { randomBytes } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { ApiKeyEntity } from 'src/entities/api-key.entity';
import { CreateApiKeyDTO } from 'src/interfaces/DTO/api-key.dto';
import { PermissionsService } from 'src/services/permissions/permissions.service';
import { RequestWithApiKey } from 'src/interfaces/request-api-key';
import { extractApiKey } from 'src/common/tools/extract-api-key';
import { RequestWithUser } from 'src/interfaces/request-user';
import { ApiKeyErrorCodes, ApiKeyException } from 'src/services/api-keys/api-keys.exception.handler';

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly apiKeyRepository: Repository<ApiKeyEntity>,

    @InjectDataSource()
    private readonly dataSource: DataSource,

    private readonly permissionService: PermissionsService,
  ) {}

  async create(
    dto: CreateApiKeyDTO,
    response: RequestWithUser,
  ): Promise<{ apiKey: string; id: string; client: string }> {
    try {
      return this.dataSource.transaction(async (transactionManager) => {
        const permissions = await Promise.all(
          dto.permissionIds.map((id) => this.permissionService.findOne(id)),
        );

        const plainApiKey = this.generatePlainKey();
        const hashedApiKey = await hash(plainApiKey, 10);

        const apiKey = transactionManager.create(ApiKeyEntity, {
          client: dto.client,
          key_hash: hashedApiKey,
          permissions,
          created_by: response.user,
        });

        await transactionManager.save(apiKey);

        return { apiKey: plainApiKey, id: apiKey.id, client: apiKey.client };
      });
    } catch (error) {
      throw new ApiKeyException(
        'Api key not created',
        ApiKeyErrorCodes.API_KEY_NOT_CREATED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async findAll(): Promise<ApiKeyEntity[]> {
    try {
      return this.apiKeyRepository.find({ relations: ['permissions'] });
    } catch (error) {
      throw new ApiKeyException(
        'Api keys not found',
        ApiKeyErrorCodes.API_KEY_NOT_FOUND,
        error.status ?? HttpStatus.NOT_FOUND
      );
    }
  }

  async findOne(id: string): Promise<ApiKeyEntity> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id },
      relations: ['permissions'],
      });
    if (!apiKey) {
      throw new ApiKeyException(
        'Api key not found',
        ApiKeyErrorCodes.API_KEY_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        );
    }
    return apiKey;
  }

  async deactivate(id: string): Promise<{ message: string }> {
    try {
      const apiKey = await this.findOne(id);

      if (!apiKey.active) {
        return { message: 'API key is already inactive' };
      }

      apiKey.active = false;
      await this.apiKeyRepository.save(apiKey);

      return { message: `API key ${id} ${apiKey.client} deactivated` };
    } catch (error) {
      throw new ApiKeyException(
        'Api key is already inactive',
        ApiKeyErrorCodes.API_KEY_ALREADY_DEACTIVATE,
        error.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }

  async canDo(rawApiKey: RequestWithApiKey, permissionCode: string): Promise<boolean> {
    const apiKey = await this.findActiveByPlainKey(extractApiKey(rawApiKey));
    if (!apiKey) {
      return false;
    }
    return apiKey.permissionCodes.includes(permissionCode);
  }

  async findActiveByPlainKey(rawApiKey: string): Promise<ApiKeyEntity> {
    const activeKeys = await this.apiKeyRepository.find({
      where: { active: true },
      relations: ['permissions'],
    });

    for (const apiKey of activeKeys) {
      const isMatch = await compare(rawApiKey, apiKey.key_hash);

      if (isMatch) return apiKey;
    }

    throw new ApiKeyException('Api key not found', ApiKeyErrorCodes.API_KEY_NOT_FOUND, HttpStatus.NOT_FOUND);
  }

  private generatePlainKey(): string {
    return randomBytes(32).toString('hex');
  }
}

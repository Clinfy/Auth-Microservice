import {ForbiddenException, Injectable, NotFoundException} from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import {compare, hash} from 'bcrypt';
import {randomBytes} from 'crypto';
import { EntityManager, Repository } from 'typeorm';
import {ApiKeyEntity} from 'src/entities/api-key.entity';
import {CreateApiKeyDTO} from 'src/interfaces/DTO/api-key.dto';
import {PermissionsService} from "src/services/permissions/permissions.service";
import {RequestWithApiKey} from "src/interfaces/request-api-key";
import {extractApiKey} from "src/common/tools/extract-api-key";
import { RequestWithUser } from 'src/interfaces/request-user';
import { OutboxEntity } from 'src/entities/outbox.entity';

@Injectable()
export class ApiKeysService {
  constructor(
      @InjectRepository(ApiKeyEntity)
      private readonly apiKeyRepository: Repository<ApiKeyEntity>,

      @InjectEntityManager()
      private readonly entityManager: EntityManager,

      private readonly permissionService: PermissionsService,
  ) {}

  async create(dto: CreateApiKeyDTO, response: RequestWithUser): Promise<{ apiKey: string; id: string; client: string }> {
    return this.entityManager.transaction(async (transactionManager)=> {
      const permissions = await Promise.all(dto.permissionIds.map(id => this.permissionService.findOne(id)));

      const plainApiKey = this.generatePlainKey();
      const hashedApiKey = await hash(plainApiKey, 10);

      const apiKey = transactionManager.create(ApiKeyEntity,{
        client: dto.client,
        key_hash: hashedApiKey,
        permissions,
        created_by: response.user
      });

      await transactionManager.save(apiKey);

      const eventPayload = {
        action: 'CREATE_API_KEY',
        api_id: apiKey.id,
        details: `new API key for client: ${apiKey.client} with permission/s: ${apiKey.permissionCodes} created`,
        done_by_id: apiKey.created_by.id,
        done_by_mail: apiKey.created_by.email,
        timestamp: new Date().toISOString()
      };

      const outbox = transactionManager.create(OutboxEntity, {
        pattern: 'api_key_created',
        destination: 'auth_queque',
        payload: eventPayload
      });

      await transactionManager.save(outbox);

      return { apiKey: plainApiKey, id: apiKey.id, client: apiKey.client };
    })
  }

  async findAll(): Promise<ApiKeyEntity[]> {
      return this.apiKeyRepository.find({ relations: ['permissions'] });
  }

  async findOne(id: string): Promise<ApiKeyEntity> {
      const apiKey = await this.apiKeyRepository.findOne({ where: { id }, relations: ['permissions'] });
      if (!apiKey) {
          throw new NotFoundException('API key not found');
      }
      return apiKey;
  }

  async deactivate(id: string): Promise<{ message: string }> {
      const apiKey = await this.findOne(id);

      if (!apiKey.active) {
          return { message: 'API key is already inactive' };
      }

      apiKey.active = false;
      await this.apiKeyRepository.save(apiKey);

      return { message: `API key ${id} ${apiKey.client} deactivated` };
  }

  async canDo(rawApiKey: RequestWithApiKey, permissionCode: string): Promise<boolean> {
      const apiKey = await this.findActiveByPlainKey(extractApiKey(rawApiKey));
      if (!apiKey) {
          return false;
      }
      return apiKey.permissionCodes.includes(permissionCode)
  }

  async findActiveByPlainKey(rawApiKey: string): Promise<ApiKeyEntity> {
      const activeKeys = await this.apiKeyRepository.find({where: { active: true },relations: ['permissions']});

      for (const apiKey of activeKeys) {

          const isMatch = await compare(rawApiKey, apiKey.key_hash);

          if (isMatch) return apiKey;

      }

      throw new ForbiddenException('Invalid or inactive API key');
  }

  private generatePlainKey(): string {
      return randomBytes(32).toString('hex')
  }
}
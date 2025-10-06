import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcrypt';
import { randomBytes } from 'crypto';
import { In, Repository } from 'typeorm';
import { ApiKeyEntity } from 'src/entities/api-key.entity';
import { PermissionEntity } from 'src/entities/permission.entity';
import { CreateApiKeyDTO } from 'src/interfaces/DTO/api-key.dto';
import {PermissionsService} from "src/services/permissions/permissions.service";

@Injectable()
export class ApiKeysService {
    constructor(
        @InjectRepository(ApiKeyEntity)
        private readonly apiKeyRepository: Repository<ApiKeyEntity>,

        private readonly permissionService: PermissionsService,
    ) {}

    async create(dto: CreateApiKeyDTO): Promise<{ apiKey: string; id: number; client: string }> {
        const permissions = await Promise.all(dto.permissionIds.map(id => this.permissionService.findOne(id)));

        const plainApiKey = this.generatePlainKey();
        const hashedApiKey = await hash(this.generatePlainKey(), 10);

        const apiKeyEntity = this.apiKeyRepository.create({
            client: dto.client,
            key_hash: hashedApiKey,
            permissions,
        });

        const savedApiKey = await this.apiKeyRepository.save(apiKeyEntity);

        return { apiKey: plainApiKey, id: savedApiKey.id, client: savedApiKey.client };
    }

    async findAll(): Promise<ApiKeyEntity[]> {
        return this.apiKeyRepository.find({ relations: ['permissions'] });
    }

    async findOne(id: number): Promise<ApiKeyEntity> {
        const apiKey = await this.apiKeyRepository.findOne({ where: { id }, relations: ['permissions'] });
        if (!apiKey) {
            throw new NotFoundException('API key not found');
        }
        return apiKey;
    }

    async deactivate(id: number): Promise<{ message: string }> {
        const apiKey = await this.findOne(id);

        if (!apiKey.active) {
            return { message: 'API key is already inactive' };
        }

        apiKey.active = false;
        await this.apiKeyRepository.save(apiKey);

        return { message: `API key ${id} ${apiKey.client} deactivated` };
    }

    async canDo(rawApiKey: string, permissionCode: string): Promise<boolean> {
        const apiKey = await this.findActiveByPlainKey(rawApiKey);
        if (!apiKey) {
            return false;
        }
        return apiKey.permissionCodes.includes(permissionCode)
    }

    async findActiveByPlainKey(rawApiKey: string): Promise<ApiKeyEntity | null> {
        const activeKeys = await this.apiKeyRepository.find({
            where: { active: true },
            relations: ['permissions'],
        });

        for (const apiKey of activeKeys) {
            const isMatch = await compare(rawApiKey, apiKey.key_hash);
            if (isMatch) {
                return apiKey;
            }
        }

        return null;
    }

    private generatePlainKey(): string {
        return randomBytes(32).toString('hex');
    }
}
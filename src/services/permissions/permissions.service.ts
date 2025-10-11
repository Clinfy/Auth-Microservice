import {Injectable, NotFoundException} from '@nestjs/common';
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {PermissionEntity} from "src/entities/permission.entity";
import {CreatePermissionDTO} from "src/interfaces/DTO/create.dto";
import {PatchPermissionDTO} from "src/interfaces/DTO/patch.dto";
import { RequestWithUser } from 'src/interfaces/request-user';

@Injectable()
export class PermissionsService {
    constructor(
        @InjectRepository(PermissionEntity)
        private readonly permissionRepository: Repository<PermissionEntity>,
    ) {}

    async create(dto: CreatePermissionDTO, request: RequestWithUser): Promise<{message: string}> {
        const permission = await this.permissionRepository.save(this.permissionRepository.create({
          ...dto,
          created_by: request.user,
        }));
        return {message: `Permission '${permission.code}' created`};
    }

    async update(id: string, dto: PatchPermissionDTO): Promise<PermissionEntity> {
        return await this.permissionRepository.save(this.permissionRepository.merge(await this.findOne(id),dto));
    }

    async delete(id: string): Promise<{ message: string }> {
        const permission = await this.findOne(id);
        await this.permissionRepository.remove(permission);
        return {message: `Permission ${permission.code} deleted`};
    }

    async findOne(id: string): Promise<PermissionEntity> {
        const permission = await this.permissionRepository.findOneBy({id});
        if(!permission) throw new NotFoundException('Permission not found');
        return permission;
    }

    async findAll(): Promise<PermissionEntity[]> {
        return await this.permissionRepository.find();
    }
}

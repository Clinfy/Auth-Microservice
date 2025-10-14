import {Injectable, NotFoundException} from '@nestjs/common';
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {RoleEntity} from "src/entities/role.entity";
import {PermissionsService} from "src/services/permissions/permissions.service";
import {CreateRoleDTO} from "src/interfaces/DTO/create.dto";
import {AssignPermissionDTO} from "src/interfaces/DTO/assign.dto";
import {PatchRoleDTO} from "src/interfaces/DTO/patch.dto";
import { RequestWithUser } from 'src/interfaces/request-user';

@Injectable()
export class RolesService {
    constructor(
        @InjectRepository(RoleEntity)
        private readonly roleRepository: Repository<RoleEntity>,

        private readonly permissionService: PermissionsService,
    ) {}

    async create(dto: CreateRoleDTO, request: RequestWithUser): Promise<RoleEntity> {
        return await this.roleRepository.save(this.roleRepository.create({
          ...dto,
          created_by: request.user
        }));
    }

    async update(id: string, dto: PatchRoleDTO): Promise<RoleEntity> {
        return await this.roleRepository.save(this.roleRepository.merge(await this.findOne(id),dto));
    }

    async delete(id: string): Promise<{ message: string }> {
        const role = await this.findOne(id);
        await this.roleRepository.remove(role);
        return {message: `Role ${role.name} deleted`};
    }

    async findOne(id: string): Promise<RoleEntity> {
        const role = await this.roleRepository.findOneBy({id});
        if(!role) throw new NotFoundException('Role not found');
        return role;
    }

    async findAll(): Promise<RoleEntity[]> {
        return await this.roleRepository.find();
    }

    async assignPermissions(roleId: string, dto: AssignPermissionDTO): Promise<RoleEntity> {
        const role = await this.findOne(roleId);
        role.permissions = await Promise.all(dto.permissionIds.map(id => this.permissionService.findOne(id)));
        return await this.roleRepository.save(role);
    }
}

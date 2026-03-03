import {Injectable, NotFoundException} from '@nestjs/common';
import {RoleEntity} from "src/entities/role.entity";
import {PermissionsService} from "src/services/permissions/permissions.service";
import {CreateRoleDTO} from "src/interfaces/DTO/create.dto";
import {AssignPermissionDTO} from "src/interfaces/DTO/assign.dto";
import {PatchRoleDTO} from "src/interfaces/DTO/patch.dto";
import { RequestWithUser } from 'src/interfaces/request-user';
import { RolesRepository } from 'src/services/roles/roles.repository';

@Injectable()
export class RolesService {
    constructor(
        private readonly roleRepository: RolesRepository,
        private readonly permissionService: PermissionsService,
    ) {}

    async create(dto: CreateRoleDTO, request: RequestWithUser): Promise<RoleEntity> {
        return await this.roleRepository.save({
          ...dto,
          created_by: request.user
        });
    }

    async update(id: string, dto: PatchRoleDTO): Promise<RoleEntity> {
        return await this.roleRepository.save(await this.roleRepository.merge(id,dto));
    }

    async delete(id: string): Promise<{ message: string }> {
        const role = await this.findOne(id);
        await this.roleRepository.remove(role);
        return {message: `Role ${role.name} deleted`};
    }

    async findOne(id: string): Promise<RoleEntity> {
        const role = await this.roleRepository.findOneById(id);
        if(!role) throw new NotFoundException('Role not found');
        return role;
    }

    async findAll(): Promise<RoleEntity[]> {
        return await this.roleRepository.findAll();
    }

    async assignPermissions(roleId: string, dto: AssignPermissionDTO): Promise<RoleEntity> {
        const role = await this.findOne(roleId);
        role.permissions = await Promise.all(dto.permissionsIds.map(id => this.permissionService.findOne(id)));
        return await this.roleRepository.save(role);
    }
}

import { HttpStatus, Injectable } from '@nestjs/common';
import { RoleEntity } from 'src/entities/role.entity';
import { PermissionsService } from 'src/services/permissions/permissions.service';
import { CreateRoleDTO } from 'src/interfaces/DTO/create.dto';
import { AssignPermissionDTO } from 'src/interfaces/DTO/assign.dto';
import { PatchRoleDTO } from 'src/interfaces/DTO/patch.dto';
import { RequestWithUser } from 'src/interfaces/request-user';
import { RolesRepository } from 'src/services/roles/roles.repository';
import { RolesErrorCodes, RolesException } from 'src/services/roles/roles.exception.handler';

@Injectable()
export class RolesService {
  constructor(
    private readonly roleRepository: RolesRepository,
    private readonly permissionService: PermissionsService,
  ) {}

  async create(dto: CreateRoleDTO, request: RequestWithUser): Promise<RoleEntity> {
    try {
      return await this.roleRepository.save(this.roleRepository.create({ ...dto, created_by: request.user }));
    } catch (error) {
      throw new RolesException(
        'Role not created',
        RolesErrorCodes.ROLES_NOT_CREATED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

  }

  async update(id: string, dto: PatchRoleDTO): Promise<RoleEntity> {
    try {
      return await this.roleRepository.save(await this.roleRepository.merge(await this.findOne(id), dto));
    } catch (error) {
      throw new RolesException(
        'Role not updated',
        RolesErrorCodes.ROLES_NOT_UPDATED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async delete(id: string): Promise<{ message: string }> {
    const role = await this.findOne(id);
    await this.roleRepository.remove(role);
    return { message: `Role ${role.name} deleted` };
  }

  async findOne(id: string): Promise<RoleEntity> {
    const role = await this.roleRepository.findOneById(id);
    if (!role) {
      throw new RolesException(
        `Role with id: ${id} not found`,
        RolesErrorCodes.ROLES_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }
    return role;
  }

  async findAll(): Promise<RoleEntity[]> {
    return await this.roleRepository.findAll();
  }

  async assignPermissions(roleId: string, dto: AssignPermissionDTO): Promise<RoleEntity> {
    const role = await this.findOne(roleId);
    role.permissions = await Promise.all(dto.permissionsIds.map((id) => this.permissionService.findOne(id)));
    return await this.roleRepository.save(role);
  }
}

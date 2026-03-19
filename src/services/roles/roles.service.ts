import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { RoleEntity } from 'src/entities/role.entity';
import { PermissionsService } from 'src/services/permissions/permissions.service';
import { CreateRoleDTO } from 'src/interfaces/DTO/create.dto';
import { AssignPermissionDTO } from 'src/interfaces/DTO/assign.dto';
import { PatchRoleDTO } from 'src/interfaces/DTO/patch.dto';
import { RequestWithUser } from 'src/interfaces/request-user';
import { RolesRepository } from 'src/services/roles/roles.repository';
import { RolesErrorCodes, RolesException } from 'src/services/roles/roles.exception';
import { SessionsService } from 'src/services/sessions/sessions.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { serializeError } from 'src/common/utils/logger-format.util';

@Injectable()
export class RolesService {
  constructor(
    private readonly roleRepository: RolesRepository,
    private readonly permissionService: PermissionsService,
    private readonly sessionService: SessionsService,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  async create(dto: CreateRoleDTO, request: RequestWithUser): Promise<RoleEntity> {
    try {
      return await this.roleRepository.save(this.roleRepository.create({ ...dto, created_by: request.user }));
    } catch (error) {
      throw new RolesException(
        'Role creation failed',
        RolesErrorCodes.ROLES_NOT_CREATED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
        error,
      );
    }
  }

  async update(id: string, dto: PatchRoleDTO): Promise<RoleEntity> {
    try {
      return await this.roleRepository.save(await this.roleRepository.merge(await this.findOne(id), dto));
    } catch (error) {
      throw new RolesException(
        'Role update failed',
        RolesErrorCodes.ROLES_NOT_UPDATED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
        error,
      );
    }
  }

  async delete(id: string): Promise<{ message: string }> {
    try {
      const role = await this.findOne(id);
      await this.roleRepository.remove(role);
      return { message: `Role ${role.name} deleted` };
    } catch (error) {
      throw new RolesException(
        'Role deletion failed',
        RolesErrorCodes.ROLES_NOT_DELETED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
        error,
      );
    }
  }

  async findOne(id: string): Promise<RoleEntity> {
    const role = await this.roleRepository.findOneById(id);
    if (!role) throw new RolesException('Role not found', RolesErrorCodes.ROLES_NOT_FOUND, HttpStatus.NOT_FOUND);
    return role;
  }

  async findAll(): Promise<RoleEntity[]> {
    try {
      return await this.roleRepository.findAll();
    } catch (error) {
      throw new RolesException(
        'Roles not found',
        RolesErrorCodes.ROLES_NOT_FOUND,
        error.status ?? HttpStatus.NOT_FOUND,
        error,
      );
    }
  }

  async assignPermissions(roleId: string, dto: AssignPermissionDTO): Promise<RoleEntity> {
    try {
      const role = await this.findOne(roleId);
      role.permissions = await Promise.all(dto.permissionsIds.map((id) => this.permissionService.findOne(id)));
      const savedRole = await this.roleRepository.save(role);

      try {
        await this.sessionService.refreshSessionPermissionsByRole(roleId);
      } catch (refreshError) {
        // Silent catch - log warning but don't fail the operation
        this.logger.warn('Failed to refresh session permissions', {
          context: 'RolesService',
          operation: 'assignPermissions',
          roleId,
          error: serializeError(refreshError),
        });
      }
      return savedRole;
    } catch (error) {
      throw new RolesException(
        'Permission assignment failed',
        RolesErrorCodes.ROLES_ASSIGN_ERROR,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
        error,
      );
    }
  }
}

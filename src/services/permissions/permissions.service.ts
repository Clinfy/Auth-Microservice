import { HttpStatus, Injectable } from '@nestjs/common';
import { PermissionEntity } from 'src/entities/permission.entity';
import { CreatePermissionDTO } from 'src/interfaces/DTO/create.dto';
import { PatchPermissionDTO } from 'src/interfaces/DTO/patch.dto';
import { RequestWithUser } from 'src/interfaces/request-user';
import { PermissionsRepository } from 'src/services/permissions/permissions.repository';
import { PermissionsErrorCodes, PermissionsException } from 'src/services/permissions/permissions.exception.handler';

@Injectable()
export class PermissionsService {
  constructor(private readonly permissionRepository: PermissionsRepository) {}

  async create(dto: CreatePermissionDTO, request: RequestWithUser): Promise<PermissionEntity> {
    try {
      return await this.permissionRepository.save(
        this.permissionRepository.create({
          ...dto,
          created_by: request.user,
        }),
      );
    } catch (error) {
      throw new PermissionsException(
        'Permission not created',
        PermissionsErrorCodes.CREATE_PERMISSION_FAILED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(id: string, dto: PatchPermissionDTO): Promise<PermissionEntity> {
    try {
      return await this.permissionRepository.save(
        await this.permissionRepository.merge(await this.findOne(id), dto),
      );
    } catch (error) {
      throw new PermissionsException(
        'Permission not updated',
        PermissionsErrorCodes.UPDATE_PERMISSION_FAILED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async delete(id: string): Promise<{ message: string }> {
    try {
      const permission = await this.findOne(id);
      await this.permissionRepository.remove(permission);
      return { message: `Permission ${permission.code} deleted` };
    } catch (error) {
      throw new PermissionsException(
        'Permission not deleted',
        PermissionsErrorCodes.DELETE_PERMISSION_FAILED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: string): Promise<PermissionEntity> {
    const permission = await this.permissionRepository.findOneById(id);
    if (!permission) throw new PermissionsException('Permission not found', PermissionsErrorCodes.PERMISSION_NOT_FOUND, HttpStatus.NOT_FOUND);
    return permission;
  }

  async findAll(): Promise<PermissionEntity[]> {
    try {
      return await this.permissionRepository.findAll();
    } catch (error) {
      throw new PermissionsException(
        'Permissions not found',
        PermissionsErrorCodes.PERMISSION_NOT_FOUND,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

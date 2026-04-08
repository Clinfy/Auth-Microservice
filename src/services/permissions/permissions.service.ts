import { HttpStatus, Injectable } from '@nestjs/common';
import { PermissionEntity } from 'src/entities/permission.entity';
import { CreatePermissionDTO } from 'src/interfaces/DTO/create.dto';
import { PatchPermissionDTO } from 'src/interfaces/DTO/patch.dto';
import { RequestWithUser } from 'src/interfaces/request-user';
import { PermissionsRepository } from 'src/services/permissions/permissions.repository';
import { PermissionsErrorCodes, PermissionsException } from 'src/services/permissions/permissions.exception';
import { PaginatedResponseDto, PaginationQueryDto } from 'src/interfaces/DTO/pagination.dto';
import { IPermission } from 'src/interfaces/permission.interface';

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
        'Permission creation failed',
        PermissionsErrorCodes.CREATE_PERMISSION_FAILED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
        error,
      );
    }
  }

  async update(id: string, dto: PatchPermissionDTO): Promise<PermissionEntity> {
    try {
      return await this.permissionRepository.save(await this.permissionRepository.merge(await this.findOne(id), dto));
    } catch (error) {
      throw new PermissionsException(
        'Permission update failed',
        PermissionsErrorCodes.UPDATE_PERMISSION_FAILED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
        error,
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
        'Permission deletion failed',
        PermissionsErrorCodes.DELETE_PERMISSION_FAILED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
        error,
      );
    }
  }

  async getDetails(): Promise<IPermission[]> {
    return await this.permissionRepository.findAllForDetails();
  }

  async findOne(id: string): Promise<PermissionEntity> {
    const permission = await this.permissionRepository.findOneById(id);
    if (!permission)
      throw new PermissionsException(
        `Permission with id ${id} not found`,
        PermissionsErrorCodes.PERMISSION_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    return permission;
  }

  async findAll(query: PaginationQueryDto = new PaginationQueryDto()): Promise<PaginatedResponseDto<PermissionEntity>> {
    try {
      const [data, total] = await this.permissionRepository.findAll(query);
      return new PaginatedResponseDto(data, total, query.page, query.limit);
    } catch (error) {
      throw new PermissionsException(
        'Permissions not found',
        PermissionsErrorCodes.PERMISSION_NOT_FOUND,
        error.status ?? HttpStatus.NOT_FOUND,
        error,
      );
    }
  }
}

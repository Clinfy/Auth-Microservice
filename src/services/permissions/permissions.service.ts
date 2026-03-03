import { Injectable, NotFoundException } from '@nestjs/common';
import { PermissionEntity } from 'src/entities/permission.entity';
import { CreatePermissionDTO } from 'src/interfaces/DTO/create.dto';
import { PatchPermissionDTO } from 'src/interfaces/DTO/patch.dto';
import { RequestWithUser } from 'src/interfaces/request-user';
import { PermissionsRepository } from 'src/services/permissions/permissions.repository';

@Injectable()
export class PermissionsService {
  constructor(private readonly permissionRepository: PermissionsRepository) {}

  async create(dto: CreatePermissionDTO, request: RequestWithUser): Promise<PermissionEntity> {
    return await this.permissionRepository.save(
      this.permissionRepository.create({
        ...dto,
        created_by: request.user,
      }),
    );
  }

  async update(id: string, dto: PatchPermissionDTO): Promise<PermissionEntity> {
    return await this.permissionRepository.save(
      await this.permissionRepository.merge(await this.findOne(id), dto),
    );
  }

  async delete(id: string): Promise<{ message: string }> {
    const permission = await this.findOne(id);
    await this.permissionRepository.remove(permission);
    return { message: `Permission ${permission.code} deleted` };
  }

  async findOne(id: string): Promise<PermissionEntity> {
    const permission = await this.permissionRepository.findOneById(id);
    if (!permission) throw new NotFoundException('Permission not found');
    return permission;
  }

  async findAll(): Promise<PermissionEntity[]> {
    return await this.permissionRepository.findAll();
  }
}

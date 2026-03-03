import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PermissionEntity } from 'src/entities/permission.entity';
import { Repository } from 'typeorm';

@Injectable()
export class PermissionsRepository {
  constructor(
    @InjectRepository(PermissionEntity)
    private readonly ormRepository: Repository<PermissionEntity>,
  ) {}

  async save(permission: PermissionEntity): Promise<PermissionEntity> {
    return await this.ormRepository.save(permission);
  }

  create(permission: Partial<PermissionEntity>): PermissionEntity {
    return this.ormRepository.create(permission);
  }

  async merge(
    permission: PermissionEntity,
    changes: Partial<PermissionEntity>,
  ): Promise<PermissionEntity> {
    return this.ormRepository.merge(permission, changes);
  }

  async findOneById(id: string): Promise<PermissionEntity | null> {
    return await this.ormRepository.findOneBy({ id });
  }

  async findAll(): Promise<PermissionEntity[]> {
    return await this.ormRepository.find();
  }

  async remove(permission: PermissionEntity): Promise<void> {
    await this.ormRepository.remove(permission);
  }
}

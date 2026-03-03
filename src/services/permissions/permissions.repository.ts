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

  async save(role: PermissionEntity): Promise<PermissionEntity> {
    return await this.ormRepository.save(role);
  }

  create(role: Partial<PermissionEntity>): PermissionEntity {
    return this.ormRepository.create(role);
  }

  async merge(id: string, changes: Partial<PermissionEntity>): Promise<PermissionEntity> {
    return this.ormRepository.merge(<PermissionEntity> await this.ormRepository.findOneBy({ id }), changes);
  }

  async findOneById(id: string): Promise<PermissionEntity | null> {
    return await this.ormRepository.findOneBy({ id });
  }

  async findAll(): Promise<PermissionEntity[]> {
    return await this.ormRepository.find();
  }

  async remove(role: PermissionEntity): Promise<void> {
    await this.ormRepository.remove(role);
  }
}
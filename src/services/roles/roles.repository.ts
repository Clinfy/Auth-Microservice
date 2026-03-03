import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RoleEntity } from 'src/entities/role.entity';
import { Repository } from 'typeorm';

@Injectable()
export class RolesRepository {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly ormRepository: Repository<RoleEntity>,
  ) {}

  async save(role: RoleEntity): Promise<RoleEntity> {
    return await this.ormRepository.save(role);
  }

  create(role: Partial<RoleEntity>): RoleEntity {
    return this.ormRepository.create(role);
  }

  async merge(role: RoleEntity, changes: Partial<RoleEntity>): Promise<RoleEntity> {
    return this.ormRepository.merge(role, changes);
  }

  async findOneById(id: string): Promise<RoleEntity | null> {
    return await this.ormRepository.findOneBy({ id });
  }

  async findAll(): Promise<RoleEntity[]> {
    return await this.ormRepository.find();
  }

  async remove(role: RoleEntity): Promise<void> {
    await this.ormRepository.remove(role);
  }
}

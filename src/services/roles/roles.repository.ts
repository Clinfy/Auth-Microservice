import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RoleEntity } from 'src/entities/role.entity';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from 'src/interfaces/DTO/pagination.dto';
import { IRole } from 'src/interfaces/role.interface';

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

  async findAll(query: PaginationQueryDto): Promise<[RoleEntity[], number]> {
    const { page, limit } = query;
    return await this.ormRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { name: 'ASC' },
    });
  }

  async findAllUnrestrictedForDetails(): Promise<IRole[]> {
    return await this.ormRepository
      .createQueryBuilder('role')
      .select('role.id', 'id')
      .addSelect('role.name', 'name')
      .where('role.is_restricted = :isRestricted', { isRestricted: false })
      .orderBy('role.name', 'ASC')
      .getRawMany<IRole>();
  }

  async findAllForDetails(): Promise<IRole[]> {
    return await this.ormRepository
      .createQueryBuilder('role')
      .select('role.id', 'id')
      .addSelect('role.name', 'name')
      .orderBy('role.name', 'ASC')
      .getRawMany<IRole>();
  }

  async remove(role: RoleEntity): Promise<void> {
    await this.ormRepository.remove(role);
  }
}

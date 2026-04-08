import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PermissionEntity } from 'src/entities/permission.entity';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from 'src/interfaces/DTO/pagination.dto';
import { IPermission } from 'src/interfaces/permission.interface';

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

  async merge(permission: PermissionEntity, changes: Partial<PermissionEntity>): Promise<PermissionEntity> {
    return this.ormRepository.merge(permission, changes);
  }

  async findOneById(id: string): Promise<PermissionEntity | null> {
    return await this.ormRepository.findOneBy({ id });
  }

  async findAll(query: PaginationQueryDto): Promise<[PermissionEntity[], number]> {
    const { page, limit } = query;
    return await this.ormRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: {code: 'ASC'}
    });
  }

  async findAllForDetails(): Promise<IPermission[]> {
    return await this.ormRepository.createQueryBuilder('permission')
      .select('permission.id', 'id')
      .addSelect('permission.code', 'code')
      .orderBy('permission.code', 'ASC')
      .getRawMany<IPermission>();
  }

  async remove(permission: PermissionEntity): Promise<void> {
    await this.ormRepository.remove(permission);
  }
}

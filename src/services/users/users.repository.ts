import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from 'src/entities/user.entity';
import { Brackets, EntityManager, Repository } from 'typeorm';
import { PaginationQueryDto } from 'src/interfaces/DTO/pagination.dto';
import { EndpointPermissionRulesEntity } from 'src/entities/endpoint-permission-rules.entity';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly ormRepository: Repository<UserEntity>,
  ) {}

  async save(user: UserEntity, manager?: EntityManager): Promise<UserEntity> {
    return await this.getManager(manager).save(user);
  }

  create(user: Partial<UserEntity>): UserEntity {
    return this.ormRepository.create(user);
  }

  async findOneByEmail(email: string): Promise<UserEntity | null> {
    return await this.ormRepository.findOneBy({ email });
  }

  async findOneById(id: string): Promise<UserEntity | null> {
    return await this.ormRepository.findOneBy({ id });
  }

  async findAll(query: PaginationQueryDto): Promise<[UserEntity[], number]> {
    const { page, limit } = query;
    return await this.ormRepository.findAndCount({
      relations: ['roles'],
      skip: (page - 1) * limit,
      take: limit,
      order: { email: 'ASC' },
    });
  }

  async findByRoleIdWithPermissions(roleId: string): Promise<UserEntity[]> {
    return await this.ormRepository.find({
      where: { roles: { id: roleId } },
      relations: ['roles', 'roles.permissions'],
    });
  }

  async getAccesibleEndpointKeys(userId: string): Promise<string[]> {
    const rows = await this.ormRepository.manager
      .getRepository(EndpointPermissionRulesEntity)
      .createQueryBuilder('epr')
      .leftJoin('epr.permissions', 'p')
      .leftJoin('p.roles', 'r')
      .leftJoin('r.users', 'u', 'u.id = :userId', { userId })
      .select('DISTINCT epr.endpoint_key_name', 'endpointKey')
      .where('epr.enabled = :enabled', { enabled: true })
      .andWhere(
        new Brackets((qb) => {
          qb.where('p.id IS NULL').orWhere('u.id IS NOT NULL');
        }),
      )
      .getRawMany<{ endpointKey: string }>();

    return rows.map((row) => row.endpointKey);
  }

  private getManager(manager?: EntityManager): Repository<UserEntity> {
    return manager ? manager.getRepository(UserEntity) : this.ormRepository;
  }
}

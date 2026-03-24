import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from 'src/entities/user.entity';
import { EntityManager, Repository } from 'typeorm';
import { PaginationQueryDto } from 'src/interfaces/DTO/pagination.dto';

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
    });
  }

  private getManager(manager?: EntityManager): Repository<UserEntity> {
    return manager ? manager.getRepository(UserEntity) : this.ormRepository;
  }
}

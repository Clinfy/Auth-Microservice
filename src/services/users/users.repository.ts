import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from 'src/entities/user.entity';
import { EntityManager, Repository } from 'typeorm';

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

  async findAll(): Promise<UserEntity[]> {
    return await this.ormRepository.find({ relations: ['roles'] });
  }

  private getManager(manager?: EntityManager): Repository<UserEntity> {
    return manager ? manager.getRepository(UserEntity) : this.ormRepository;
  }
}

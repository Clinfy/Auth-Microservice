import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiKeyEntity } from 'src/entities/api-key.entity';
import { EntityManager, Repository } from 'typeorm';

@Injectable()
export class ApiKeysRepository {
  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly ormRepository: Repository<ApiKeyEntity>,
  ) {}

  async save(apiKey: ApiKeyEntity, manager?: EntityManager): Promise<ApiKeyEntity> {
    return await this.getManager(manager).save(apiKey);
  }

  create(apiKey: Partial<ApiKeyEntity>): ApiKeyEntity {
    return this.ormRepository.create(apiKey);
  }

  async findOneById(id: string): Promise<ApiKeyEntity | null> {
    return await this.ormRepository.findOne({
      where: { id },
      relations: ['permissions'],
    });
  }

  async findAll(): Promise<ApiKeyEntity[]> {
    return await this.ormRepository.find({ relations: ['permissions'] });
  }

  async findAllActive(): Promise<ApiKeyEntity[]> {
    return await this.ormRepository.find({
      where: { active: true },
      relations: ['permissions'],
    });
  }

  private getManager(manager?: EntityManager): Repository<ApiKeyEntity> {
    return manager ? manager.getRepository(ApiKeyEntity) : this.ormRepository;
  }
}

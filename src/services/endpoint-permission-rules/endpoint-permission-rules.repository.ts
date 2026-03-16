import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EndpointPermissionRulesEntity } from 'src/entities/endpoint-permission-rules.entity';

@Injectable()
export class EndpointPermissionRulesRepository {
  constructor(
    @InjectRepository(EndpointPermissionRulesEntity)
    private readonly ormRepository: Repository<EndpointPermissionRulesEntity>,
  ) {}

  async save(endpointPermissionRule: EndpointPermissionRulesEntity): Promise<EndpointPermissionRulesEntity> {
    return await this.ormRepository.save(endpointPermissionRule);
  }

  create(endpointPermissionRule: Partial<EndpointPermissionRulesEntity>): EndpointPermissionRulesEntity {
    return this.ormRepository.create(endpointPermissionRule);
  }

  async merge(
    endpointPermissionRule: EndpointPermissionRulesEntity,
    changes: Partial<EndpointPermissionRulesEntity>,
  ): Promise<EndpointPermissionRulesEntity> {
    return this.ormRepository.merge(endpointPermissionRule, changes);
  }

  async findOneById(id: string): Promise<EndpointPermissionRulesEntity | null> {
    return await this.ormRepository.findOneBy({ id });
  }

  async findAll(): Promise<EndpointPermissionRulesEntity[]> {
    return await this.ormRepository.find();
  }

  async findByEndpointKey(endpointKeyName: string): Promise<EndpointPermissionRulesEntity | null> {
    return await this.ormRepository.findOne({
      where: { endpoint_key_name: endpointKeyName },
    });
  }

  async findAllEnabled(): Promise<EndpointPermissionRulesEntity[]> {
    return await this.ormRepository.find({
      where: { enabled: true },
    });
  }

  async remove(endpointPermissionRule: EndpointPermissionRulesEntity): Promise<void> {
    await this.ormRepository.remove(endpointPermissionRule);
  }
}

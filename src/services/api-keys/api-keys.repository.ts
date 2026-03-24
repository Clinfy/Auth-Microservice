import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiKeyEntity } from 'src/entities/api-key.entity';
import { EntityManager, In, Repository } from 'typeorm';
import { PaginationQueryDto } from 'src/interfaces/DTO/pagination.dto';

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

  async findAll(query: PaginationQueryDto): Promise<[ApiKeyEntity[], number]> {
    const { page, limit } = query;
    return await this.ormRepository.findAndCount({
      relations: ['permissions'],
      skip: (page - 1) * limit,
      take: limit,
      order: { client: 'ASC' },
    });
  }

  async findAllActive(): Promise<ApiKeyEntity[]> {
    return await this.ormRepository.find({
      where: { active: true },
      relations: ['permissions'],
    });
  }

  /**
   * Finds an API key by its HMAC fingerprint.
   * Uses indexed O(1) lookup on key_fingerprint column.
   */
  async findByFingerprint(fingerprint: string): Promise<ApiKeyEntity | null> {
    return await this.ormRepository.findOne({
      where: { key_fingerprint: fingerprint, active: true },
      relations: ['permissions'],
    });
  }

  /**
   * Given a list of fingerprints, returns the subset that are still active in DB.
   * Single query using IN (...) — no relations loaded, only key_fingerprint is selected.
   */
  async findActiveFingerprintsIn(fingerprints: string[]): Promise<string[]> {
    if (!fingerprints.length) return [];
    const rows = await this.ormRepository.find({
      select: { key_fingerprint: true },
      where: {
        key_fingerprint: In(fingerprints),
        active: true,
      },
    });

    return rows.map((r) => r.key_fingerprint);
  }

  private getManager(manager?: EntityManager): Repository<ApiKeyEntity> {
    return manager ? manager.getRepository(ApiKeyEntity) : this.ormRepository;
  }
}

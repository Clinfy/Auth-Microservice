import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKeysRepository } from './api-keys.repository';
import { ApiKeyEntity } from 'src/entities/api-key.entity';
import { PaginationQueryDto } from 'src/interfaces/DTO/pagination.dto';

describe('ApiKeysRepository', () => {
  let repository: ApiKeysRepository;
  let ormRepository: jest.Mocked<Repository<ApiKeyEntity>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeysRepository,
        {
          provide: getRepositoryToken(ApiKeyEntity),
          useValue: {
            findAndCount: jest.fn(),
            findOneBy: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<ApiKeysRepository>(ApiKeysRepository);
    ormRepository = module.get(getRepositoryToken(ApiKeyEntity));
  });

  describe('findAll', () => {
    it('returns paginated result with correct shape', async () => {
      const mockEntities = [{ id: 'k-1' }, { id: 'k-2' }] as ApiKeyEntity[];
      const total = 2;
      ormRepository.findAndCount.mockResolvedValue([mockEntities, total]);

      const query = Object.assign(new PaginationQueryDto(), { page: 2, limit: 10 });
      const result = await repository.findAll(query);

      expect(result).toEqual([mockEntities, total]);
    });

    it('passes correct skip/take to findAndCount', async () => {
      ormRepository.findAndCount.mockResolvedValue([[], 0]);

      const query = Object.assign(new PaginationQueryDto(), { page: 2, limit: 10 });
      await repository.findAll(query);

      expect(ormRepository.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
    });

    it('passes correct order option to findAndCount', async () => {
      ormRepository.findAndCount.mockResolvedValue([[], 0]);

      const query = Object.assign(new PaginationQueryDto(), { page: 1, limit: 20 });
      await repository.findAll(query);

      expect(ormRepository.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ order: { client: 'ASC', id: "ASC" } }));
    });

    it('passes relations option with permissions to findAndCount', async () => {
      ormRepository.findAndCount.mockResolvedValue([[], 0]);

      const query = Object.assign(new PaginationQueryDto(), { page: 1, limit: 20 });
      await repository.findAll(query);

      expect(ormRepository.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ relations: ['permissions'] }));
    });
  });
});

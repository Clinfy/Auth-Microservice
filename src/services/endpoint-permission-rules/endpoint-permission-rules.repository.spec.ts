import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EndpointPermissionRulesRepository } from './endpoint-permission-rules.repository';
import { EndpointPermissionRulesEntity } from 'src/entities/endpoint-permission-rules.entity';
import { PaginationQueryDto } from 'src/interfaces/DTO/pagination.dto';

describe('EndpointPermissionRulesRepository', () => {
  let repository: EndpointPermissionRulesRepository;
  let ormRepository: jest.Mocked<Repository<EndpointPermissionRulesEntity>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EndpointPermissionRulesRepository,
        {
          provide: getRepositoryToken(EndpointPermissionRulesEntity),
          useValue: {
            findAndCount: jest.fn(),
            findOneBy: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            merge: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<EndpointPermissionRulesRepository>(EndpointPermissionRulesRepository);
    ormRepository = module.get(getRepositoryToken(EndpointPermissionRulesEntity));
  });

  describe('findAll', () => {
    it('returns paginated result with correct shape', async () => {
      const mockEntities = [{ id: 'e-1' }, { id: 'e-2' }] as EndpointPermissionRulesEntity[];
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

      expect(ormRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ order: { endpoint_key_name: 'ASC' } }),
      );
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { UsersRepository } from './users.repository';
import { UserEntity } from 'src/entities/user.entity';
import { PaginationQueryDto } from 'src/interfaces/DTO/pagination.dto';
import { EndpointPermissionRulesEntity } from 'src/entities/endpoint-permission-rules.entity';

describe('UsersRepository', () => {
  let repository: UsersRepository;
  let ormRepository: jest.Mocked<Repository<UserEntity>>;
  let endpointRulesRepository: { createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    endpointRulesRepository = {
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersRepository,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: {
            findAndCount: jest.fn(),
            findOneBy: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            manager: {
              getRepository: jest.fn().mockReturnValue(endpointRulesRepository),
            },
          },
        },
      ],
    }).compile();

    repository = module.get<UsersRepository>(UsersRepository);
    ormRepository = module.get(getRepositoryToken(UserEntity));
  });

  describe('findAll', () => {
    it('returns paginated result with correct shape', async () => {
      const mockEntities = [{ id: 'u-1' }, { id: 'u-2' }] as UserEntity[];
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

      expect(ormRepository.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ order: { email: 'ASC' } }));
    });

    it('passes relations option with roles to findAndCount', async () => {
      ormRepository.findAndCount.mockResolvedValue([[], 0]);

      const query = Object.assign(new PaginationQueryDto(), { page: 1, limit: 20 });
      await repository.findAll(query);

      expect(ormRepository.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ relations: ['roles'] }));
    });
  });

  describe('getAccesibleEndpointKeys', () => {
    const createQueryBuilderMock = (rows: { endpointKey: string }[]) => {
      const queryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(rows),
      };

      endpointRulesRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      return queryBuilder;
    };

    it('queries enabled endpoint rules directly so rules without permissions can be included', async () => {
      const queryBuilder = createQueryBuilderMock([{ endpointKey: 'users.read' }, { endpointKey: 'health.check' }]);

      const result = await repository.getAccesibleEndpointKeys('user-1');

      expect(ormRepository.manager.getRepository).toHaveBeenCalledWith(EndpointPermissionRulesEntity);
      expect(endpointRulesRepository.createQueryBuilder).toHaveBeenCalledWith('epr');
      expect(queryBuilder.leftJoin).toHaveBeenNthCalledWith(1, 'epr.permissions', 'p');
      expect(queryBuilder.leftJoin).toHaveBeenNthCalledWith(2, 'p.roles', 'r');
      expect(queryBuilder.leftJoin).toHaveBeenNthCalledWith(3, 'r.users', 'u', 'u.id = :userId', { userId: 'user-1' });
      expect(queryBuilder.select).toHaveBeenCalledWith('DISTINCT epr.endpoint_key_name', 'endpointKey');
      expect(queryBuilder.where).toHaveBeenCalledWith('epr.enabled = :enabled', { enabled: true });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(expect.any(Brackets));
      expect(result).toEqual(['users.read', 'health.check']);
    });
  });
});

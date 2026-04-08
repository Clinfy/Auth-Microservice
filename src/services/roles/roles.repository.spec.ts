import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolesRepository } from './roles.repository';
import { RoleEntity } from 'src/entities/role.entity';
import { PaginationQueryDto } from 'src/interfaces/DTO/pagination.dto';
import { IRole } from 'src/interfaces/role.interface';

describe('RolesRepository', () => {
  let repository: RolesRepository;
  let ormRepository: jest.Mocked<Repository<RoleEntity>>;
  let qb: Record<string, jest.Mock>;

  beforeEach(async () => {
    qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesRepository,
        {
          provide: getRepositoryToken(RoleEntity),
          useValue: {
            findAndCount: jest.fn(),
            findOneBy: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            merge: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue(qb),
          },
        },
      ],
    }).compile();

    repository = module.get<RolesRepository>(RolesRepository);
    ormRepository = module.get(getRepositoryToken(RoleEntity));
  });

  describe('findAllForDetails', () => {
    it('returns raw id and name for each role', async () => {
      const details: IRole[] = [
        { id: 'r-1', name: 'ADMIN' },
        { id: 'r-2', name: 'VIEWER' },
      ];
      qb.getRawMany.mockResolvedValue(details);

      const result = await repository.findAllForDetails();

      expect(result).toEqual(details);
    });

    it('selects role.id as id and role.name as name', async () => {
      qb.getRawMany.mockResolvedValue([]);

      await repository.findAllForDetails();

      expect(qb.select).toHaveBeenCalledWith('role.id', 'id');
      expect(qb.addSelect).toHaveBeenCalledWith('role.name', 'name');
    });

    it('orders results by role.name ASC', async () => {
      qb.getRawMany.mockResolvedValue([]);

      await repository.findAllForDetails();

      expect(qb.orderBy).toHaveBeenCalledWith('role.name', 'ASC');
    });
  });

  describe('findAll', () => {
    it('returns paginated result with correct shape', async () => {
      const mockEntities = [{ id: 'r-1' }, { id: 'r-2' }] as RoleEntity[];
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

      expect(ormRepository.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ order: { name: 'ASC' } }));
    });
  });
});

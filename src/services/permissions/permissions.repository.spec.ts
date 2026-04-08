import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionsRepository } from './permissions.repository';
import { PermissionEntity } from 'src/entities/permission.entity';
import { PaginationQueryDto } from 'src/interfaces/DTO/pagination.dto';
import { IPermission } from 'src/interfaces/permission.interface';

describe('PermissionsRepository', () => {
  let repository: PermissionsRepository;
  let ormRepository: jest.Mocked<Repository<PermissionEntity>>;
  let qb: Record<string, jest.Mock>;

  beforeEach(async () => {
    qb = {
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsRepository,
        {
          provide: getRepositoryToken(PermissionEntity),
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

    repository = module.get<PermissionsRepository>(PermissionsRepository);
    ormRepository = module.get(getRepositoryToken(PermissionEntity));
  });

  describe('findAllForDetails', () => {
    it('returns raw id and code for each permission', async () => {
      const details: IPermission[] = [
        { id: 'p-1', code: 'PERM_READ' },
        { id: 'p-2', code: 'PERM_WRITE' },
      ];
      qb.getRawMany.mockResolvedValue(details);

      const result = await repository.findAllForDetails();

      expect(result).toEqual(details);
    });

    it('selects only permission.id and permission.code columns', async () => {
      qb.getRawMany.mockResolvedValue([]);

      await repository.findAllForDetails();

      expect(qb.select).toHaveBeenCalledWith(['permission.id', 'permission.code']);
    });

    it('orders results by permission.code ASC', async () => {
      qb.getRawMany.mockResolvedValue([]);

      await repository.findAllForDetails();

      expect(qb.orderBy).toHaveBeenCalledWith('permission.code', 'ASC');
    });
  });

  describe('findAll', () => {
    it('returns paginated result with correct shape', async () => {
      const mockEntities = [{ id: 'p-1' }, { id: 'p-2' }] as PermissionEntity[];
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

      expect(ormRepository.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ order: { code: 'ASC' } }));
    });
  });
});

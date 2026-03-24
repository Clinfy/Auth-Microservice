import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PermissionsService } from 'src/services/permissions/permissions.service';
import { PermissionsRepository } from 'src/services/permissions/permissions.repository';
import { PermissionEntity } from 'src/entities/permission.entity';
import { IBackup, IMemoryDb, newDb } from 'pg-mem';
import { entities } from 'src/entities';
import { randomUUID } from 'crypto';

describe('PermissionsService (integration)', () => {
  let moduleRef: TestingModule;
  let service: PermissionsService;
  let repository: Repository<PermissionEntity>;
  let dataSource: DataSource;
  let db: IMemoryDb;
  let backup: IBackup;

  beforeAll(async () => {
    db = newDb();

    db.public.registerFunction({
      name: 'current_database',
      implementation: () => 'permissions_test',
    });

    db.public.registerFunction({
      name: 'version',
      implementation: () => 'PostgreSQL 17.6',
    });

    db.public.registerFunction({
      name: 'uuid_generate_v4',
      implementation: () => randomUUID(),
    });

    db.public.registerFunction({
      name: 'gen_random_uuid',
      implementation: () => randomUUID(),
    });

    dataSource = await db.adapters.createTypeormDataSource({
      type: 'postgres',
      entities: [...entities],
      synchronize: true,
    });

    await dataSource.initialize();

    moduleRef = await Test.createTestingModule({
      imports: [],
      providers: [
        PermissionsService,
        PermissionsRepository,
        {
          provide: getRepositoryToken(PermissionEntity),
          useValue: dataSource.getRepository(PermissionEntity),
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = moduleRef.get(PermissionsService);
    repository = moduleRef.get(getRepositoryToken(PermissionEntity));
    backup = db.backup();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    backup.restore();
  });

  it('persists a new permission with the provided code', async () => {
    const created = await service.create({ code: 'PERMISSIONS_CREATE' }, request);

    expect(created).toMatchObject({
      id: expect.any(String),
      code: 'PERMISSIONS_CREATE',
    });

    const stored = await repository.findOneBy({ id: created.id });
    expect(stored).toBeDefined();
    expect(stored?.code).toBe('PERMISSIONS_CREATE');
  });

  it('updates an existing permission code', async () => {
    const created = await service.create({ code: 'PERMISSIONS_UPDATE' }, request);

    const updated = await service.update(created.id, {
      code: 'PERMISSIONS_EDIT',
    });
    expect(updated.code).toBe('PERMISSIONS_EDIT');

    const stored = await repository.findOneBy({ id: created.id });
    expect(stored?.code).toBe('PERMISSIONS_EDIT');
  });

  it('deletes a permission and returns a confirmation message', async () => {
    const created = await service.create({ code: 'PERMISSIONS_DELETE' }, request);

    const response = await service.delete(created.id);
    expect(response).toEqual({ message: `Permission ${created.code} deleted` });

    const stored = await repository.findOneBy({ id: created.id });
    expect(stored).toBeNull();
  });

  it('findAll returns a paginated response of permissions', async () => {
    const created = await service.create({ code: 'PAGINATED_PERM' }, request);

    const result = await service.findAll({ page: 1, limit: 20 });

    expect(result.data).toBeDefined();
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.totalPages).toBeGreaterThanOrEqual(1);
    const codes = result.data.map((p) => p.code);
    expect(codes).toContain('PAGINATED_PERM');
  });

  it('findAll returns permissions sorted by code ASC', async () => {
    // Use explicit UUIDs to avoid pg-mem UUID sequence collision after backup.restore()
    await repository.save(repository.create({ id: randomUUID(), code: 'Z_PERM' }));
    await repository.save(repository.create({ id: randomUUID(), code: 'A_PERM' }));

    const result = await service.findAll({ page: 1, limit: 20 });

    expect(result.data.length).toBeGreaterThanOrEqual(2);
    const codes = result.data.map((p) => p.code);
    for (let i = 0; i < codes.length - 1; i++) {
      expect(codes[i].localeCompare(codes[i + 1])).toBeLessThanOrEqual(0);
    }
  });
});
const request = { user: null } as any;

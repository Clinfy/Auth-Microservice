import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PermissionsService } from 'src/services/permissions/permissions.service';
import { PermissionEntity } from 'src/entities/permission.entity';
import { entities } from 'src/entities';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

describe('PermissionsService (integration)', () => {
  let moduleRef: TestingModule;
  let service: PermissionsService;
  let repository: Repository<PermissionEntity>;
  let dataSource: DataSource;
  let container: StartedPostgreSqlContainer;

  jest.setTimeout(60000); // 1 minute timeout

  beforeAll(async () => {

    console.log('Starting PostgreSQL container...');
    container = await new PostgreSqlContainer('postgres:17.6').start()
    console.log('PostgreSQL container started');

    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      entities: [...entities],
      synchronize: true
    })

    await dataSource.initialize();

    moduleRef = await Test.createTestingModule({
      imports: [],
      providers: [
        PermissionsService,
        {
          provide: getRepositoryToken(PermissionEntity),
          useValue: dataSource.getRepository(PermissionEntity),
        },
        {
          provide: DataSource,
          useValue: dataSource,
        }
      ],
    }).compile();

    service = moduleRef.get(PermissionsService);
    repository = moduleRef.get(getRepositoryToken(PermissionEntity));
  });

  afterAll(async () => {
    await dataSource.destroy();
    await container.stop();
  });

  beforeEach(async () => {
    await dataSource.synchronize(true)
  });

  it('persists a new permission with the provided code', async () => {
    const created = await service.create({ code: 'PERMISSIONS_CREATE' });

    expect(created).toMatchObject({
      id: expect.any(String),
      code: 'PERMISSIONS_CREATE',
    });

    const stored = await repository.findOneBy({ id: created.id });
    expect(stored).toBeDefined();
    expect(stored?.code).toBe('PERMISSIONS_CREATE');
  });

  it('updates an existing permission code', async () => {
    const created = await service.create({ code: 'PERMISSIONS_UPDATE' });

    const updated = await service.update(created.id, { code: 'PERMISSIONS_EDIT' });
    expect(updated.code).toBe('PERMISSIONS_EDIT');

    const stored = await repository.findOneBy({ id: created.id });
    expect(stored?.code).toBe('PERMISSIONS_EDIT');
  });

  it('deletes a permission and returns a confirmation message', async () => {
    const created = await service.create({ code: 'PERMISSIONS_DELETE' });

    const response = await service.delete(created.id);
    expect(response).toEqual({ message: `Permission ${created.code} deleted` });

    const stored = await repository.findOneBy({ id: created.id });
    expect(stored).toBeNull();
  });
});

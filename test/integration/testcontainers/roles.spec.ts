import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RolesService } from 'src/services/roles/roles.service';
import { PermissionsService } from 'src/services/permissions/permissions.service';
import { RolesRepository } from 'src/services/roles/roles.repository';
import { PermissionsRepository } from 'src/services/permissions/permissions.repository';
import { RoleEntity } from 'src/entities/role.entity';
import { PermissionEntity } from 'src/entities/permission.entity';
import { SessionsService } from 'src/services/sessions/sessions.service';
import { entities } from 'src/entities';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

describe('RolesService (integration)', () => {
  let moduleRef: TestingModule;
  let service: RolesService;
  let permissionsService: PermissionsService;
  let roleRepository: Repository<RoleEntity>;
  let dataSource: DataSource;
  let container: StartedPostgreSqlContainer;
  const request = { user: null } as any;

  jest.setTimeout(60000);

  beforeAll(async () => {
    console.log('Starting PostgreSQL container...');
    container = await new PostgreSqlContainer('postgres:17.6').start();
    console.log('PostgreSQL container started');

    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      entities: [...entities],
      synchronize: true,
    });

    await dataSource.initialize();

    moduleRef = await Test.createTestingModule({
      imports: [],
      providers: [
        RolesService,
        PermissionsService,
        RolesRepository,
        PermissionsRepository,
        {
          provide: SessionsService,
          useValue: {
            refreshSessionPermissions: jest.fn().mockResolvedValue(undefined),
            refreshSessionPermissionsByRole: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: getRepositoryToken(RoleEntity),
          useValue: dataSource.getRepository(RoleEntity),
        },
        {
          provide: getRepositoryToken(PermissionEntity),
          useValue: dataSource.getRepository(PermissionEntity),
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: {
            warn: jest.fn(),
            error: jest.fn(),
            info: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(RolesService);
    permissionsService = moduleRef.get(PermissionsService);
    roleRepository = moduleRef.get(getRepositoryToken(RoleEntity));
  });

  afterAll(async () => {
    await dataSource.destroy();
    await container.stop();
  });

  beforeEach(async () => {
    await dataSource.synchronize(true);
  });

  it('creates a role with the given name', async () => {
    const role = await service.create({ name: 'admin' }, request);

    expect(role).toMatchObject({
      id: expect.any(String),
      name: 'admin',
    });

    const stored = await roleRepository.findOneBy({ id: role.id });
    expect(stored).toBeDefined();
    expect(stored?.name).toBe('admin');
  });

  it('assigns permissions to a role', async () => {
    const read = await permissionsService.create({ code: 'PERMISSIONS_READ' }, request);
    const write = await permissionsService.create({ code: 'PERMISSIONS_WRITE' }, request);
    const role = await service.create({ name: 'editor' }, request);

    const updated = await service.assignPermissions(role.id, {
      permissionsIds: [read.id, write.id],
    } as any);

    expect(updated.permissions.map((permission) => permission.code).sort()).toEqual([
      'PERMISSIONS_READ',
      'PERMISSIONS_WRITE',
    ]);

    const stored = await roleRepository.findOne({
      where: { id: role.id },
      relations: ['permissions'],
    });
    expect(stored?.permissions).toHaveLength(2);
  });

  it('deletes a role and confirms removal', async () => {
    const role = await service.create({ name: 'temp-role' }, request);

    const response = await service.delete(role.id);
    expect(response).toEqual({ message: `Role ${role.name} deleted` });

    const exists = await roleRepository.findOneBy({ id: role.id });
    expect(exists).toBeNull();
  });

  it('findAll returns a paginated response of roles', async () => {
    await service.create({ name: 'paginated-role' }, request);

    const result = await service.findAll({ page: 1, limit: 20 });

    expect(result.data).toBeDefined();
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.totalPages).toBeGreaterThanOrEqual(1);
    const names = result.data.map((r) => r.name);
    expect(names).toContain('paginated-role');
  });

  it('findAll returns roles sorted by name ASC', async () => {
    // Create roles with intentionally out-of-order names
    await service.create({ name: 'z-role' }, request);
    await service.create({ name: 'a-role' }, request);

    const result = await service.findAll({ page: 1, limit: 20 });

    expect(result.data.length).toBeGreaterThanOrEqual(2);
    const names = result.data.map((r) => r.name);
    for (let i = 0; i < names.length - 1; i++) {
      expect(names[i].localeCompare(names[i + 1])).toBeLessThanOrEqual(0);
    }
  });
});

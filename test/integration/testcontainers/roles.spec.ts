import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RolesService } from 'src/services/roles/roles.service';
import { PermissionsService } from 'src/services/permissions/permissions.service';
import { RoleEntity } from 'src/entities/role.entity';
import { PermissionEntity } from 'src/entities/permission.entity';
import { entities } from 'src/entities';
import { PostgreSqlContainer, StartedPostgreSqlContainer, } from '@testcontainers/postgresql';

describe('RolesService (integration)', () => {
  let moduleRef: TestingModule;
  let service: RolesService;
  let permissionsService: PermissionsService;
  let roleRepository: Repository<RoleEntity>;
  let dataSource: DataSource;
  let container: StartedPostgreSqlContainer;

  jest.setTimeout(60000);

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

    await dataSource.initialize()

    moduleRef = await Test.createTestingModule({
      imports: [],
      providers: [
        RolesService, PermissionsService,
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
        }
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
    await dataSource.synchronize(true)
  });

  it('creates a role with the given name', async () => {
    const role = await service.create({ name: 'admin' });

    expect(role).toMatchObject({
      id: expect.any(String),
      name: 'admin',
    });

    const stored = await roleRepository.findOneBy({ id: role.id });
    expect(stored).toBeDefined();
    expect(stored?.name).toBe('admin');
  });

  it('assigns permissions to a role', async () => {
    const read = await permissionsService.create({ code: 'PERMISSIONS_READ' });
    const write = await permissionsService.create({ code: 'PERMISSIONS_WRITE' });
    const role = await service.create({ name: 'editor' });

    const updated = await service.assignPermissions(role.id, { permissionIds: [read.id, write.id] });

    expect(updated.permissions.map(permission => permission.code).sort()).toEqual([
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
    const role = await service.create({ name: 'temp-role' });

    const response = await service.delete(role.id);
    expect(response).toEqual({ message: `Role ${role.name} deleted` });

    const exists = await roleRepository.findOneBy({ id: role.id });
    expect(exists).toBeNull();
  });
});

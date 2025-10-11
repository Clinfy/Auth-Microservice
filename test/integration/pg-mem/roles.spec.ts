import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RolesService } from 'src/services/roles/roles.service';
import { PermissionsService } from 'src/services/permissions/permissions.service';
import { RoleEntity } from 'src/entities/role.entity';
import { PermissionEntity } from 'src/entities/permission.entity';
import { IBackup, IMemoryDb, newDb } from 'pg-mem';
import { entities } from 'src/entities';
import { randomUUID } from 'crypto';

describe('RolesService (integration)', () => {
  let moduleRef: TestingModule;
  let service: RolesService;
  let permissionsService: PermissionsService;
  let permissionsRepository: Repository<PermissionEntity>;
  let roleRepository: Repository<RoleEntity>;
  let dataSource: DataSource;
  let db: IMemoryDb;
  let backup: IBackup;

  beforeAll(async () => {
    db = newDb();

    db.public.registerFunction({
      name: 'current_database',
      implementation: () => 'roles_test'
    })

    db.public.registerFunction({
      name: 'version',
      implementation: () => 'PostgreSQL 17.6'
    })

    db.public.registerFunction({
      name: 'uuid_generate_v4',
      implementation: () => randomUUID()
    })

    db.public.registerFunction({
      name: 'gen_random_uuid',
      implementation: () => randomUUID()
    })

    dataSource = await db.adapters.createTypeormDataSource({
      type: 'postgres',
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
    permissionsRepository = moduleRef.get(getRepositoryToken(PermissionEntity));
    backup = db.backup();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    backup.restore();
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
    const createPermission = async (code: string) =>
      permissionsRepository.save(permissionsRepository.create({ id: randomUUID(), code }));

    const read = await createPermission('PERMISSIONS_READ');
    const write = await createPermission('PERMISSIONS_WRITE');
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

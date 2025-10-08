import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RolesService } from 'src/services/roles/roles.service';
import { PermissionsService } from 'src/services/permissions/permissions.service';
import { RoleEntity } from 'src/entities/role.entity';
import { PermissionEntity } from 'src/entities/permission.entity';
import { UserEntity } from 'src/entities/user.entity';
import { ApiKeyEntity } from 'src/entities/api-key.entity';

describe('RolesService (integration)', () => {
  let moduleRef: TestingModule;
  let service: RolesService;
  let permissionsService: PermissionsService;
  let roleRepository: Repository<RoleEntity>;
  let dataSource: DataSource;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          dropSchema: true,
          entities: [RoleEntity, PermissionEntity, UserEntity, ApiKeyEntity],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([RoleEntity, PermissionEntity]),
      ],
      providers: [RolesService, PermissionsService],
    }).compile();

    service = moduleRef.get(RolesService);
    permissionsService = moduleRef.get(PermissionsService);
    roleRepository = moduleRef.get(getRepositoryToken(RoleEntity));
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.synchronize(true);
  });

  it('creates a role with the given name', async () => {
    const role = await service.create({ name: 'admin' });

    expect(role).toMatchObject({
      id: expect.any(Number),
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

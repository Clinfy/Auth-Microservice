import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { CreateRoleDTO } from 'src/interfaces/DTO/create.dto';
import { PatchRoleDTO } from 'src/interfaces/DTO/patch.dto';
import { AssignPermissionDTO } from 'src/interfaces/DTO/assign.dto';
import { RoleEntity } from 'src/entities/role.entity';

describe('RolesController', () => {
  let controller: RolesController;
  let service: jest.Mocked<RolesService>;
  const roleId = '11111111-1111-1111-1111-111111111111';
  const anotherRoleId = '22222222-2222-2222-2222-222222222222';
  const permissionIdA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const permissionIdB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  beforeEach(() => {
    service = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn(),
      assignPermissions: jest.fn(),
    } as unknown as jest.Mocked<RolesService>;

    controller = new RolesController(service);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a role', async () => {
    const dto: CreateRoleDTO = { name: 'admin' };
    const role = { id: roleId, name: 'admin' } as RoleEntity;
    service.create.mockResolvedValue(role);

    await expect(controller.create(dto)).resolves.toEqual(role);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('should update a role', async () => {
    const dto: PatchRoleDTO = { name: 'updated' };
    const role = { id: roleId, name: 'updated' } as RoleEntity;
    service.update.mockResolvedValue(role);

    await expect(controller.edit(dto, roleId)).resolves.toEqual(role);
    expect(service.update).toHaveBeenCalledWith(roleId, dto);
  });

  it('should assign permissions to a role', async () => {
    const dto: AssignPermissionDTO = { permissionIds: [permissionIdA, permissionIdB] };
    const role = { id: roleId, name: 'with-perms' } as RoleEntity;
    service.assignPermissions.mockResolvedValue(role);

    await expect(controller.assignPermissions(roleId, dto)).resolves.toEqual(role);
    expect(service.assignPermissions).toHaveBeenCalledWith(roleId, dto);
  });

  it('should delete a role', async () => {
    const response = { message: 'Role deleted' };
    service.delete.mockResolvedValue(response);

    await expect(controller.delete(anotherRoleId)).resolves.toEqual(response);
    expect(service.delete).toHaveBeenCalledWith(anotherRoleId);
  });

  it('should find a role by id', async () => {
    const role = { id: roleId, name: 'one' } as RoleEntity;
    service.findOne.mockResolvedValue(role);

    await expect(controller.findOne(roleId)).resolves.toEqual(role);
    expect(service.findOne).toHaveBeenCalledWith(roleId);
  });

  it('should list all roles', async () => {
    const roles = [{ id: roleId, name: 'a' }] as RoleEntity[];
    service.findAll.mockResolvedValue(roles);

    await expect(controller.findAll()).resolves.toEqual(roles);
    expect(service.findAll).toHaveBeenCalledTimes(1);
  });
});

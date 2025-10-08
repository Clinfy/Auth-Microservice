import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { CreateRoleDTO } from 'src/interfaces/DTO/create.dto';
import { PatchRoleDTO } from 'src/interfaces/DTO/patch.dto';
import { AssignPermissionDTO } from 'src/interfaces/DTO/assign.dto';
import { RoleEntity } from 'src/entities/role.entity';

describe('RolesController', () => {
  let controller: RolesController;
  let service: jest.Mocked<RolesService>;

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
    const role = { id: 1, name: 'admin' } as RoleEntity;
    service.create.mockResolvedValue(role);

    await expect(controller.create(dto)).resolves.toEqual(role);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('should update a role', async () => {
    const dto: PatchRoleDTO = { name: 'updated' };
    const role = { id: 2, name: 'updated' } as RoleEntity;
    service.update.mockResolvedValue(role);

    await expect(controller.edit(dto, 2 as any)).resolves.toEqual(role);
    expect(service.update).toHaveBeenCalledWith(2, dto);
  });

  it('should assign permissions to a role', async () => {
    const dto: AssignPermissionDTO = { permissionIds: [1, 2] };
    const role = { id: 3, name: 'with-perms' } as RoleEntity;
    service.assignPermissions.mockResolvedValue(role);

    await expect(controller.assignPermissions(3 as any, dto)).resolves.toEqual(role);
    expect(service.assignPermissions).toHaveBeenCalledWith(3, dto);
  });

  it('should delete a role', async () => {
    const response = { message: 'Role deleted' };
    service.delete.mockResolvedValue(response);

    await expect(controller.delete(4 as any)).resolves.toEqual(response);
    expect(service.delete).toHaveBeenCalledWith(4);
  });

  it('should find a role by id', async () => {
    const role = { id: 5, name: 'one' } as RoleEntity;
    service.findOne.mockResolvedValue(role);

    await expect(controller.findOne(5 as any)).resolves.toEqual(role);
    expect(service.findOne).toHaveBeenCalledWith(5);
  });

  it('should list all roles', async () => {
    const roles = [{ id: 1, name: 'a' }] as RoleEntity[];
    service.findAll.mockResolvedValue(roles);

    await expect(controller.findAll()).resolves.toEqual(roles);
    expect(service.findAll).toHaveBeenCalledTimes(1);
  });
});

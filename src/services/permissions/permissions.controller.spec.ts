import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';
import { CreatePermissionDTO } from 'src/interfaces/DTO/create.dto';
import { PatchPermissionDTO } from 'src/interfaces/DTO/patch.dto';
import { PermissionEntity } from 'src/entities/permission.entity';

describe('PermissionsController', () => {
  let controller: PermissionsController;
  let service: jest.Mocked<PermissionsService>;
  const permissionId = '11111111-1111-1111-1111-111111111111';
  const secondPermissionId = '22222222-2222-2222-2222-222222222222';
  const request = { user: { id: '33333333-3333-3333-3333-333333333333' } } as any;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<PermissionsService>;

    controller = new PermissionsController(service);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a permission', async () => {
    const dto: CreatePermissionDTO = { code: 'PERMISSION' };
    const entity = { id: permissionId, code: 'PERMISSION' } as PermissionEntity;
    service.create.mockResolvedValue(entity);

    await expect(controller.create(request, dto)).resolves.toEqual(entity);
    expect(service.create).toHaveBeenCalledWith(dto, request);
  });

  it('should update a permission', async () => {
    const dto: PatchPermissionDTO = { code: 'UPDATED' };
    const entity = { id: permissionId, code: 'UPDATED' } as PermissionEntity;
    service.update.mockResolvedValue(entity);

    await expect(controller.edit(dto, permissionId)).resolves.toEqual(entity);
    expect(service.update).toHaveBeenCalledWith(permissionId, dto);
  });

  it('should delete a permission', async () => {
    const response = { message: 'deleted' };
    service.delete.mockResolvedValue(response);

    await expect(controller.delete(permissionId)).resolves.toEqual(response);
    expect(service.delete).toHaveBeenCalledWith(permissionId);
  });

  it('should find one permission', async () => {
    const permission = { id: permissionId, code: 'EXISTING' } as PermissionEntity;
    service.findOne.mockResolvedValue(permission);

    await expect(controller.findOne(permissionId)).resolves.toEqual(permission);
    expect(service.findOne).toHaveBeenCalledWith(permissionId);
  });

  it('should list all permissions', async () => {
    const permissions = [
      { id: permissionId, code: 'P1' },
      { id: secondPermissionId, code: 'P2' },
    ] as PermissionEntity[];
    service.findAll.mockResolvedValue(permissions);

    await expect(controller.findAll()).resolves.toEqual(permissions);
    expect(service.findAll).toHaveBeenCalledTimes(1);
  });
});

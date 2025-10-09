import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';
import { CreatePermissionDTO } from 'src/interfaces/DTO/create.dto';
import { PatchPermissionDTO } from 'src/interfaces/DTO/patch.dto';
import { PermissionEntity } from 'src/entities/permission.entity';

describe('PermissionsController', () => {
  let controller: PermissionsController;
  let service: jest.Mocked<PermissionsService>;

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
    const entity = { id: 1, code: 'PERMISSION' } as PermissionEntity;
    service.create.mockResolvedValue(entity);

    await expect(controller.create(dto)).resolves.toEqual(entity);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('should update a permission', async () => {
    const dto: PatchPermissionDTO = { code: 'UPDATED' };
    const entity = { id: 1, code: 'UPDATED' } as PermissionEntity;
    service.update.mockResolvedValue(entity);

    await expect(controller.edit(dto, 1 as any)).resolves.toEqual(entity);
    expect(service.update).toHaveBeenCalledWith(1, dto);
  });

  it('should delete a permission', async () => {
    const response = { message: 'deleted' };
    service.delete.mockResolvedValue(response);

    await expect(controller.delete(3 as any)).resolves.toEqual(response);
    expect(service.delete).toHaveBeenCalledWith(3);
  });

  it('should find one permission', async () => {
    const permission = { id: 4, code: 'EXISTING' } as PermissionEntity;
    service.findOne.mockResolvedValue(permission);

    await expect(controller.findOne(4 as any)).resolves.toEqual(permission);
    expect(service.findOne).toHaveBeenCalledWith(4);
  });

  it('should list all permissions', async () => {
    const permissions = [
      { id: 1, code: 'P1' },
      { id: 2, code: 'P2' },
    ] as PermissionEntity[];
    service.findAll.mockResolvedValue(permissions);

    await expect(controller.findAll()).resolves.toEqual(permissions);
    expect(service.findAll).toHaveBeenCalledTimes(1);
  });
});

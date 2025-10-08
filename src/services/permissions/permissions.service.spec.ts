import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PermissionsService } from './permissions.service';
import { PermissionEntity } from 'src/entities/permission.entity';

describe('PermissionsService', () => {
  let permissionRepository: jest.Mocked<Partial<Repository<PermissionEntity>>>;
  let service: PermissionsService;

  beforeEach(() => {
    permissionRepository = {
      save: jest.fn(),
      create: jest.fn(),
      merge: jest.fn((entity, dto) => ({ ...entity, ...dto } as any)),
      findOneBy: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
    };

    service = new PermissionsService(permissionRepository as any);
  });

  it('creates a permission', async () => {
    (permissionRepository.save as jest.Mock).mockResolvedValue({ id: 1, code: 'PERM_CREATE' });

    await expect(service.create({ code: 'PERM_CREATE' })).resolves.toEqual({ id: 1, code: 'PERM_CREATE' });
    expect(permissionRepository.create).toHaveBeenCalledWith({ code: 'PERM_CREATE' });
  });

  it('updates a permission', async () => {
    (permissionRepository.findOneBy as jest.Mock).mockResolvedValue({ id: 1, code: 'OLD' });
    (permissionRepository.save as jest.Mock).mockResolvedValue({ id: 1, code: 'NEW' });

    await expect(service.update(1, { code: 'NEW' })).resolves.toEqual({ id: 1, code: 'NEW' });
    expect(permissionRepository.merge).toHaveBeenCalledWith({ id: 1, code: 'OLD' }, { code: 'NEW' });
  });

  it('deletes a permission and returns message', async () => {
    (permissionRepository.findOneBy as jest.Mock).mockResolvedValue({ id: 5, code: 'TO_DELETE' });
    (permissionRepository.remove as jest.Mock).mockResolvedValue(undefined);

    await expect(service.delete(5)).resolves.toEqual({ message: 'Permission TO_DELETE deleted' });
    expect(permissionRepository.remove).toHaveBeenCalledWith({ id: 5, code: 'TO_DELETE' });
  });

  it('findOne throws NotFoundException when missing', async () => {
    (permissionRepository.findOneBy as jest.Mock).mockResolvedValue(null);

    await expect(service.findOne(100)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findAll returns list of permissions', async () => {
    (permissionRepository.find as jest.Mock).mockResolvedValue([{ id: 1, code: 'PERM' }]);

    await expect(service.findAll()).resolves.toEqual([{ id: 1, code: 'PERM' }]);
  });
});

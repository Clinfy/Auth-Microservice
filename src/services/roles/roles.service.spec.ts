import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RolesService } from './roles.service';
import { RoleEntity } from 'src/entities/role.entity';
import { PermissionsService } from '../permissions/permissions.service';

describe('RolesService', () => {
  let roleRepository: jest.Mocked<Partial<Repository<RoleEntity>>>;
  let permissionsService: jest.Mocked<Partial<PermissionsService>>;
  let service: RolesService;

  beforeEach(() => {
    roleRepository = {
      save: jest.fn(),
      create: jest.fn(),
      merge: jest.fn((entity, dto) => ({ ...entity, ...dto } as any)),
      findOneBy: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
    };

    permissionsService = {
      findOne: jest.fn(),
    };

    service = new RolesService(roleRepository as any, permissionsService as any);
  });

  it('creates a role', async () => {
    (roleRepository.save as jest.Mock).mockResolvedValue({ id: 1, name: 'ADMIN' });

    await expect(service.create({ name: 'ADMIN' })).resolves.toEqual({ id: 1, name: 'ADMIN' });
    expect(roleRepository.create).toHaveBeenCalledWith({ name: 'ADMIN' });
  });

  it('updates a role with merged data', async () => {
    (roleRepository.findOneBy as jest.Mock).mockResolvedValue({ id: 1, name: 'OLD' });
    (roleRepository.save as jest.Mock).mockResolvedValue({ id: 1, name: 'NEW' });

    await expect(service.update(1, { name: 'NEW' })).resolves.toEqual({ id: 1, name: 'NEW' });
    expect(roleRepository.merge).toHaveBeenCalledWith({ id: 1, name: 'OLD' }, { name: 'NEW' });
  });

  it('deletes a role and returns message', async () => {
    (roleRepository.findOneBy as jest.Mock).mockResolvedValue({ id: 2, name: 'TO_DELETE' });
    (roleRepository.remove as jest.Mock).mockResolvedValue(undefined);

    await expect(service.delete(2)).resolves.toEqual({ message: 'Role TO_DELETE deleted' });
    expect(roleRepository.remove).toHaveBeenCalledWith({ id: 2, name: 'TO_DELETE' });
  });

  it('findOne throws NotFoundException when role missing', async () => {
    (roleRepository.findOneBy as jest.Mock).mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findAll returns all roles', async () => {
    (roleRepository.find as jest.Mock).mockResolvedValue([{ id: 1, name: 'ADMIN' }]);

    await expect(service.findAll()).resolves.toEqual([{ id: 1, name: 'ADMIN' }]);
  });

  it('assignPermissions loads permissions and saves role', async () => {
    (roleRepository.findOneBy as jest.Mock).mockResolvedValue({ id: 1, name: 'ADMIN', permissions: [] });
    (permissionsService.findOne as jest.Mock)
      .mockResolvedValueOnce({ id: 10, code: 'PERM_A' })
      .mockResolvedValueOnce({ id: 20, code: 'PERM_B' });
    (roleRepository.save as jest.Mock).mockResolvedValue({
      id: 1,
      name: 'ADMIN',
      permissions: [{ id: 10 }, { id: 20 }],
    });

    await expect(service.assignPermissions(1, { permissionIds: [10, 20] })).resolves.toEqual({
      id: 1,
      name: 'ADMIN',
      permissions: [{ id: 10 }, { id: 20 }],
    });

    expect(permissionsService.findOne).toHaveBeenNthCalledWith(1, 10);
    expect(permissionsService.findOne).toHaveBeenNthCalledWith(2, 20);
  });
});

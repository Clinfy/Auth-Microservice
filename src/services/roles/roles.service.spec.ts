import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RolesService } from './roles.service';
import { RoleEntity } from 'src/entities/role.entity';
import { PermissionsService } from '../permissions/permissions.service';

describe('RolesService', () => {
  let roleRepository: jest.Mocked<Partial<Repository<RoleEntity>>>;
  let permissionsService: jest.Mocked<Partial<PermissionsService>>;
  let service: RolesService;
  const roleId = '11111111-1111-1111-1111-111111111111';
  const otherRoleId = '22222222-2222-2222-2222-222222222222';
  const permissionIdA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const permissionIdB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const actingUser = { id: '99999999-9999-9999-9999-999999999999' } as any;
  const request = { user: actingUser } as any;

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
    (roleRepository.save as jest.Mock).mockResolvedValue({ id: roleId, name: 'ADMIN' });

    await expect(service.create({ name: 'ADMIN' }, request)).resolves.toEqual({ id: roleId, name: 'ADMIN' });
    expect(roleRepository.create).toHaveBeenCalledWith({ name: 'ADMIN', created_by: actingUser });
  });

  it('updates a role with merged data', async () => {
    (roleRepository.findOneBy as jest.Mock).mockResolvedValue({ id: roleId, name: 'OLD' });
    (roleRepository.save as jest.Mock).mockResolvedValue({ id: roleId, name: 'NEW' });

    await expect(service.update(roleId, { name: 'NEW' })).resolves.toEqual({ id: roleId, name: 'NEW' });
    expect(roleRepository.merge).toHaveBeenCalledWith({ id: roleId, name: 'OLD' }, { name: 'NEW' });
  });

  it('deletes a role and returns message', async () => {
    (roleRepository.findOneBy as jest.Mock).mockResolvedValue({ id: otherRoleId, name: 'TO_DELETE' });
    (roleRepository.remove as jest.Mock).mockResolvedValue(undefined);

    await expect(service.delete(otherRoleId)).resolves.toEqual({ message: 'Role TO_DELETE deleted' });
    expect(roleRepository.remove).toHaveBeenCalledWith({ id: otherRoleId, name: 'TO_DELETE' });
  });

  it('findOne throws NotFoundException when role missing', async () => {
    (roleRepository.findOneBy as jest.Mock).mockResolvedValue(null);

    await expect(service.findOne(otherRoleId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findAll returns all roles', async () => {
    (roleRepository.find as jest.Mock).mockResolvedValue([{ id: roleId, name: 'ADMIN' }]);

    await expect(service.findAll()).resolves.toEqual([{ id: roleId, name: 'ADMIN' }]);
  });

  it('assignPermissions loads permissions and saves role', async () => {
    (roleRepository.findOneBy as jest.Mock).mockResolvedValue({ id: roleId, name: 'ADMIN', permissions: [] });
    (permissionsService.findOne as jest.Mock)
      .mockResolvedValueOnce({ id: permissionIdA, code: 'PERM_A' })
      .mockResolvedValueOnce({ id: permissionIdB, code: 'PERM_B' });
    (roleRepository.save as jest.Mock).mockResolvedValue({
      id: roleId,
      name: 'ADMIN',
      permissions: [{ id: permissionIdA }, { id: permissionIdB }],
    });

    await expect(service.assignPermissions(roleId, { permissionsIds: [permissionIdA, permissionIdB] })).resolves.toEqual({
      id: roleId,
      name: 'ADMIN',
      permissions: [{ id: permissionIdA }, { id: permissionIdB }],
    });

    expect(permissionsService.findOne).toHaveBeenNthCalledWith(1, permissionIdA);
    expect(permissionsService.findOne).toHaveBeenNthCalledWith(2, permissionIdB);
  });
});

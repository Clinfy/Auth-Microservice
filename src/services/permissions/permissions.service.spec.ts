import { PermissionsRepository } from './permissions.repository';
import { PermissionsService } from './permissions.service';
import { PermissionsException } from './permissions.exception';
import { PaginatedResponseDto, PaginationQueryDto } from 'src/interfaces/DTO/pagination.dto';
import { IPermission } from 'src/interfaces/permission.interface';

describe('PermissionsService', () => {
  let permissionRepository: jest.Mocked<Partial<PermissionsRepository>>;
  let service: PermissionsService;
  const permissionId = '11111111-1111-1111-1111-111111111111';
  const otherPermissionId = '22222222-2222-2222-2222-222222222222';
  const missingPermissionId = '99999999-9999-9999-9999-999999999999';
  const actingUser = { id: '99999999-9999-9999-9999-888888888888' } as any;
  const request = { user: actingUser } as any;

  beforeEach(() => {
    permissionRepository = {
      save: jest.fn(),
      create: jest.fn(),
      merge: jest.fn((entity, dto) => ({ ...entity, ...dto }) as any),
      findOneById: jest.fn(),
      findAll: jest.fn(),
      findAllForDetails: jest.fn(),
      remove: jest.fn(),
    };

    service = new PermissionsService(permissionRepository as any);
  });

  it('creates a permission', async () => {
    (permissionRepository.save as jest.Mock).mockResolvedValue({
      id: permissionId,
      code: 'PERM_CREATE',
    });

    await expect(service.create({ code: 'PERM_CREATE' }, request)).resolves.toEqual({
      id: permissionId,
      code: 'PERM_CREATE',
    });
    expect(permissionRepository.create).toHaveBeenCalledWith({
      code: 'PERM_CREATE',
      created_by: actingUser,
    });
  });

  it('updates a permission', async () => {
    (permissionRepository.findOneById as jest.Mock).mockResolvedValue({
      id: permissionId,
      code: 'OLD',
    });
    (permissionRepository.save as jest.Mock).mockResolvedValue({
      id: permissionId,
      code: 'NEW',
    });

    await expect(service.update(permissionId, { code: 'NEW' })).resolves.toEqual({
      id: permissionId,
      code: 'NEW',
    });
    expect(permissionRepository.merge).toHaveBeenCalledWith(
      { id: permissionId, code: 'OLD' },
      {
        code: 'NEW',
      },
    );
  });

  it('deletes a permission and returns message', async () => {
    (permissionRepository.findOneById as jest.Mock).mockResolvedValue({
      id: otherPermissionId,
      code: 'TO_DELETE',
    });
    (permissionRepository.remove as jest.Mock).mockResolvedValue(undefined);

    await expect(service.delete(otherPermissionId)).resolves.toEqual({
      message: 'Permission TO_DELETE deleted',
    });
    expect(permissionRepository.remove).toHaveBeenCalledWith({
      id: otherPermissionId,
      code: 'TO_DELETE',
    });
  });

  it('findOne throws PermissionsException when missing', async () => {
    (permissionRepository.findOneById as jest.Mock).mockResolvedValue(null);

    await expect(service.findOne(missingPermissionId)).rejects.toBeInstanceOf(PermissionsException);
  });

  it('getDetails returns id and code for each permission', async () => {
    const details: IPermission[] = [
      { id: permissionId, code: 'PERM_READ' },
      { id: otherPermissionId, code: 'PERM_WRITE' },
    ];
    (permissionRepository.findAllForDetails as jest.Mock).mockResolvedValue(details);

    await expect(service.getDetails()).resolves.toEqual(details);
    expect(permissionRepository.findAllForDetails).toHaveBeenCalledTimes(1);
  });

  it('findAll returns a PaginatedResponseDto wrapping all permissions', async () => {
    const permissions = [{ id: permissionId, code: 'PERM' }];
    (permissionRepository.findAll as jest.Mock).mockResolvedValue([permissions, 1]);

    const query = new PaginationQueryDto();
    const result = await service.findAll(query);

    expect(result).toBeInstanceOf(PaginatedResponseDto);
    expect(result.data).toEqual(permissions);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.totalPages).toBe(1);
  });
});

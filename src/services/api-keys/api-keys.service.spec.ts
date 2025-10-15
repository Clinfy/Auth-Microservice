import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyEntity } from 'src/entities/api-key.entity';

jest.mock('bcrypt', () => ({
  hash: jest.fn(async () => 'HASHED'),
  compare: jest.fn(async () => false),
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => 'PLAINTEXT_KEY'),
  })),
}));

import { hash, compare } from 'bcrypt';
import { randomBytes } from 'crypto';

describe('ApiKeysService', () => {
  let repository: jest.Mocked<Partial<Repository<any>>>;
  let permissionsService: jest.Mocked<{ findOne: jest.Mock }>;
  let dataSource: { transaction: jest.Mock };
  let transactionManager: { create: jest.Mock; save: jest.Mock };
  let service: ApiKeysService;
  const permissionId = '11111111-1111-1111-1111-111111111111';
  const apiKeyId = '33333333-3333-3333-3333-333333333333';
  const secondApiKeyId = '44444444-4444-4444-4444-444444444444';
  const actingUser = { id: '55555555-5555-5555-5555-555555555555' } as any;
  const request = { user: actingUser } as any;

  const hashMock = hash as jest.MockedFunction<typeof hash>;
  const compareMock = compare as jest.MockedFunction<typeof compare>;
  const randomBytesMock = randomBytes as jest.MockedFunction<typeof randomBytes>;

  beforeEach(() => {
    hashMock.mockClear();
    compareMock.mockClear();
    randomBytesMock.mockClear();

    repository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    permissionsService = {
      findOne: jest.fn(),
    };

    transactionManager = {
      create: jest.fn((_entity, data) => ({ ...data })),
      save: jest.fn(async entity => Object.assign(entity, { id: apiKeyId })),
    };

    dataSource = {
      transaction: jest.fn(async callback => callback(transactionManager as any)),
    };

    service = new ApiKeysService(repository as any, dataSource as any, permissionsService as any);
  });

  it('creates API key and returns plaintext key', async () => {
    (permissionsService.findOne as jest.Mock).mockResolvedValue({ id: permissionId, code: 'PERM' });

    await expect(service.create({ client: 'client-app', permissionIds: [permissionId] }, request)).resolves.toEqual({
      apiKey: 'PLAINTEXT_KEY',
      id: apiKeyId,
      client: 'client-app',
    });

    expect(randomBytesMock).toHaveBeenCalledWith(32);
    expect(hashMock).toHaveBeenCalled();
    expect(transactionManager.create).toHaveBeenCalledWith(ApiKeyEntity, {
      client: 'client-app',
      key_hash: 'HASHED',
      permissions: [{ id: permissionId, code: 'PERM' }],
      created_by: actingUser,
    });
    expect(transactionManager.save).toHaveBeenCalledWith(expect.objectContaining({ client: 'client-app' }));
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('findAll returns API keys with relations', async () => {
    (repository.find as jest.Mock).mockResolvedValue([{ id: apiKeyId }]);

    await expect(service.findAll()).resolves.toEqual([{ id: apiKeyId }]);
    expect(repository.find).toHaveBeenCalledWith({ relations: ['permissions'] });
  });

  it('findOne returns key when present or throws', async () => {
    (repository.findOne as jest.Mock).mockResolvedValueOnce(null);

    await expect(service.findOne(apiKeyId)).rejects.toBeInstanceOf(NotFoundException);

    (repository.findOne as jest.Mock).mockResolvedValueOnce({ id: apiKeyId });
    await expect(service.findOne(apiKeyId)).resolves.toEqual({ id: apiKeyId });
  });

  it('deactivate disables active API key', async () => {
    const activeKey = { id: apiKeyId, client: 'client', active: true };
    (repository.findOne as jest.Mock).mockResolvedValue(activeKey);
    (repository.save as jest.Mock).mockResolvedValue(undefined);

    await expect(service.deactivate(apiKeyId)).resolves.toEqual({ message: `API key ${apiKeyId} client deactivated` });
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ id: apiKeyId, active: false }));
  });

  it('findActiveByPlainKey returns matching active key', async () => {
    const keys = [
      { id: apiKeyId, key_hash: 'HASH1', active: true },
      { id: secondApiKeyId, key_hash: 'HASH2', active: true },
    ];
    (repository.find as jest.Mock).mockResolvedValue(keys);
    compareMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await expect(service.findActiveByPlainKey('PLAINTEXT')).resolves.toEqual(keys[1]);
    expect(compareMock).toHaveBeenNthCalledWith(1, 'PLAINTEXT', 'HASH1');
    expect(compareMock).toHaveBeenNthCalledWith(2, 'PLAINTEXT', 'HASH2');
  });

  it('findActiveByPlainKey throws when no key matches', async () => {
    (repository.find as jest.Mock).mockResolvedValue([{ id: apiKeyId, key_hash: 'HASH', active: true }]);
    compareMock.mockResolvedValue(false);

    await expect(service.findActiveByPlainKey('PLAINTEXT')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('canDo returns true when permission exists', async () => {
    jest.spyOn(service, 'findActiveByPlainKey').mockResolvedValue({ permissionCodes: ['READ'] } as any);
    const request: any = { headers: { 'x-api-key': 'PLAINTEXT' } };

    await expect(service.canDo(request, 'READ')).resolves.toBe(true);
  });

  it('canDo returns false when permission missing', async () => {
    jest.spyOn(service, 'findActiveByPlainKey').mockResolvedValue({ permissionCodes: ['WRITE'] } as any);
    const request: any = { headers: { 'x-api-key': 'PLAINTEXT' } };

    await expect(service.canDo(request, 'READ')).resolves.toBe(false);
  });

  it('canDo propagates exception when API key invalid', async () => {
    jest.spyOn(service, 'findActiveByPlainKey').mockRejectedValue(new ForbiddenException('Invalid'));
    const request: any = { headers: { 'x-api-key': 'PLAINTEXT' } };

    await expect(service.canDo(request, 'READ')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

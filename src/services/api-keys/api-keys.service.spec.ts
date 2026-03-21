import { HttpStatus } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysRepository } from './api-keys.repository';
import { ApiKeyEntity } from 'src/entities/api-key.entity';
import { ApiKeyErrorCodes, ApiKeyException } from 'src/services/api-keys/api-keys.exception.handler';

// Mock node:crypto — HMAC-SHA256 replaces bcrypt
const MOCK_PLAIN_KEY = 'ab'.repeat(32); // 64 hex chars from randomBytes(32)
const MOCK_FINGERPRINT = 'ff'.repeat(32);

jest.mock('node:crypto', () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => MOCK_PLAIN_KEY),
  })),
  createHmac: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => MOCK_FINGERPRINT),
  })),
}));

import { randomBytes, createHmac } from 'node:crypto';

describe('ApiKeysService', () => {
  let repository: jest.Mocked<Partial<ApiKeysRepository>>;
  let permissionsService: jest.Mocked<{ findOne: jest.Mock }>;
  let configService: { getOrThrow: jest.Mock };
  let redisService: {
    raw: {
      get: jest.Mock;
      multi: jest.Mock;
      sMembers: jest.Mock;
    };
  };
  let logger: { info: jest.Mock; warn: jest.Mock; debug: jest.Mock; error: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let transactionManager: { create: jest.Mock; save: jest.Mock };
  let service: ApiKeysService;
  let multiMock: { set: jest.Mock; del: jest.Mock; sAdd: jest.Mock; sRem: jest.Mock; exec: jest.Mock };

  const permissionId = '11111111-1111-1111-1111-111111111111';
  const secondPermissionId = '22222222-2222-2222-2222-222222222222';
  const apiKeyId = '33333333-3333-3333-3333-333333333333';
  const secondApiKeyId = '44444444-4444-4444-4444-444444444444';
  const actingUser = { id: '55555555-5555-5555-5555-555555555555' } as any;
  const request = { user: actingUser } as any;

  const randomBytesMock = randomBytes as jest.MockedFunction<typeof randomBytes>;
  const createHmacMock = createHmac as jest.MockedFunction<typeof createHmac>;

  beforeEach(() => {
    jest.clearAllMocks();

    multiMock = {
      set: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      sAdd: jest.fn().mockReturnThis(),
      sRem: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };

    repository = {
      create: jest.fn(),
      save: jest.fn(),
      findAll: jest.fn(),
      findOneById: jest.fn(),
      findAllActive: jest.fn(),
      findByFingerprint: jest.fn(),
    };

    permissionsService = {
      findOne: jest.fn(),
    };

    configService = {
      getOrThrow: jest.fn().mockReturnValue('test-hmac-secret-that-is-long-enough'),
    };

    redisService = {
      raw: {
        get: jest.fn().mockResolvedValue(null),
        multi: jest.fn(() => multiMock),
        sMembers: jest.fn().mockResolvedValue([]),
      },
    };

    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    };

    transactionManager = {
      create: jest.fn((_entity, data) => ({ ...data })),
      save: jest.fn(async (entity) => Object.assign(entity, { id: apiKeyId })),
    };

    dataSource = {
      transaction: jest.fn(async (callback) => callback(transactionManager as any)),
    };

    service = new ApiKeysService(
      repository as any,
      dataSource as any,
      permissionsService as any,
      configService as any,
      redisService as any,
      logger as any,
    );
  });

  // ── create ──────────────────────────────────────────────────────────

  it('creates API key and returns plaintext key', async () => {
    permissionsService.findOne.mockResolvedValue({ id: permissionId, code: 'PERM' });

    await expect(service.create({ client: 'client-app', permissionIds: [permissionId] }, request)).resolves.toEqual({
      apiKey: MOCK_PLAIN_KEY,
      id: apiKeyId,
      client: 'client-app',
    });

    expect(randomBytesMock).toHaveBeenCalledWith(32);
    expect(createHmacMock).toHaveBeenCalledWith('sha256', 'test-hmac-secret-that-is-long-enough');
    expect(transactionManager.create).toHaveBeenCalledWith(ApiKeyEntity, {
      client: 'client-app',
      key_fingerprint: MOCK_FINGERPRINT,
      permissions: [{ id: permissionId, code: 'PERM' }],
      created_by: actingUser,
    });
    expect(transactionManager.save).toHaveBeenCalledWith(expect.objectContaining({ client: 'client-app' }));
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('create wraps errors in ApiKeyException', async () => {
    permissionsService.findOne.mockRejectedValue(new Error('DB down'));

    await expect(service.create({ client: 'x', permissionIds: [permissionId] }, request)).rejects.toBeInstanceOf(
      ApiKeyException,
    );
  });

  // ── findAll ─────────────────────────────────────────────────────────

  it('findAll returns API keys with relations', async () => {
    (repository.findAll as jest.Mock).mockResolvedValue([{ id: apiKeyId }]);

    await expect(service.findAll()).resolves.toEqual([{ id: apiKeyId }]);
    expect(repository.findAll).toHaveBeenCalled();
  });

  // ── findOne ─────────────────────────────────────────────────────────

  it('findOne returns key when present', async () => {
    (repository.findOneById as jest.Mock).mockResolvedValueOnce({ id: apiKeyId });
    await expect(service.findOne(apiKeyId)).resolves.toEqual({ id: apiKeyId });
  });

  it('findOne throws when key not found', async () => {
    (repository.findOneById as jest.Mock).mockResolvedValueOnce(null);
    await expect(service.findOne(apiKeyId)).rejects.toBeInstanceOf(ApiKeyException);
  });

  // ── deactivate ──────────────────────────────────────────────────────

  it('deactivate disables active API key and invalidates cache', async () => {
    const activeKey = {
      id: apiKeyId,
      client: 'client',
      active: true,
      key_fingerprint: MOCK_FINGERPRINT,
    };
    (repository.findOneById as jest.Mock).mockResolvedValue(activeKey);
    (repository.save as jest.Mock).mockResolvedValue(undefined);

    await expect(service.deactivate(apiKeyId)).resolves.toEqual({
      message: `API key ${apiKeyId} client deactivated`,
    });

    // Cache invalidation: del + sRem
    expect(multiMock.del).toHaveBeenCalledWith(`api_key:fp:${MOCK_FINGERPRINT}`);
    expect(multiMock.sRem).toHaveBeenCalledWith('api_keys', MOCK_FINGERPRINT);
    expect(multiMock.exec).toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ id: apiKeyId, active: false }));
  });

  it('deactivate throws when key already deactivated', async () => {
    (repository.findOneById as jest.Mock).mockResolvedValue({
      id: apiKeyId,
      client: 'client',
      active: false,
    });

    await expect(service.deactivate(apiKeyId)).rejects.toThrow(ApiKeyException);
  });

  // ── activate ────────────────────────────────────────────────────────

  it('activate enables inactive API key and loads to cache', async () => {
    const inactiveKey = {
      id: apiKeyId,
      client: 'client',
      active: false,
      key_fingerprint: MOCK_FINGERPRINT,
      permissions: [{ code: 'READ' }],
      permissionCodes: ['READ'],
    };
    (repository.findOneById as jest.Mock).mockResolvedValue(inactiveKey);
    (repository.save as jest.Mock).mockResolvedValue(undefined);

    await expect(service.activate(apiKeyId)).resolves.toEqual({
      message: `API key ${apiKeyId} client activated`,
    });

    // Cache load: set + sAdd
    expect(multiMock.set).toHaveBeenCalledWith(
      `api_key:fp:${MOCK_FINGERPRINT}`,
      JSON.stringify({ client: 'client', permissionCodes: ['READ'] }),
    );
    expect(multiMock.sAdd).toHaveBeenCalledWith('api_keys', MOCK_FINGERPRINT);
    expect(multiMock.exec).toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ id: apiKeyId, active: true }));
  });

  it('activate throws when key already active', async () => {
    (repository.findOneById as jest.Mock).mockResolvedValue({
      id: apiKeyId,
      client: 'client',
      active: true,
    });

    await expect(service.activate(apiKeyId)).rejects.toThrow(ApiKeyException);
  });

  // ── changePermissions ───────────────────────────────────────────────

  it('changePermissions updates permissions and invalidates cache', async () => {
    const existingKey = {
      id: apiKeyId,
      client: 'client',
      active: true,
      key_fingerprint: MOCK_FINGERPRINT,
      permissions: [{ id: permissionId, code: 'READ' }],
      permissionCodes: ['READ'],
    };
    (repository.findOneById as jest.Mock).mockResolvedValue(existingKey);
    permissionsService.findOne.mockResolvedValue({ id: secondPermissionId, code: 'WRITE' });
    (repository.save as jest.Mock).mockResolvedValue(undefined);

    const result = await service.changePermissions(apiKeyId, {
      permissionsIds: [secondPermissionId],
    });

    expect(result.permissions).toEqual([{ id: secondPermissionId, code: 'WRITE' }]);
    // Cache invalidation
    expect(multiMock.del).toHaveBeenCalledWith(`api_key:fp:${MOCK_FINGERPRINT}`);
    expect(multiMock.sRem).toHaveBeenCalledWith('api_keys', MOCK_FINGERPRINT);
    expect(multiMock.exec).toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalled();
  });

  it('changePermissions wraps errors in ApiKeyException', async () => {
    (repository.findOneById as jest.Mock).mockRejectedValue(new Error('DB down'));

    await expect(service.changePermissions(apiKeyId, { permissionsIds: [permissionId] })).rejects.toBeInstanceOf(
      ApiKeyException,
    );
  });

  // ── findActiveByPlainKey ────────────────────────────────────────────

  it('findActiveByPlainKey returns permissions from Redis cache hit', async () => {
    const cached = JSON.stringify({ client: 'client', permissionCodes: ['READ', 'WRITE'] });
    redisService.raw.get.mockResolvedValue(cached);

    const result = await service.findActiveByPlainKey('some-plain-key');

    expect(result).toEqual(['READ', 'WRITE']);
    expect(redisService.raw.get).toHaveBeenCalledWith(`api_key:fp:${MOCK_FINGERPRINT}`);
    // Should NOT hit DB on cache hit
    expect(repository.findByFingerprint).not.toHaveBeenCalled();
  });

  it('findActiveByPlainKey falls back to DB on cache miss and backfills', async () => {
    redisService.raw.get.mockResolvedValue(null);
    const dbKey = {
      id: apiKeyId,
      client: 'client',
      key_fingerprint: MOCK_FINGERPRINT,
      permissionCodes: ['READ'],
    };
    (repository.findByFingerprint as jest.Mock).mockResolvedValue(dbKey);

    const result = await service.findActiveByPlainKey('some-plain-key');

    expect(result).toEqual(['READ']);
    expect(repository.findByFingerprint).toHaveBeenCalledWith(MOCK_FINGERPRINT);
    // Backfill cache
    expect(multiMock.set).toHaveBeenCalledWith(
      `api_key:fp:${MOCK_FINGERPRINT}`,
      JSON.stringify({ client: 'client', permissionCodes: ['READ'] }),
    );
    expect(multiMock.sAdd).toHaveBeenCalledWith('api_keys', MOCK_FINGERPRINT);
  });

  it('findActiveByPlainKey throws when no key found in DB', async () => {
    redisService.raw.get.mockResolvedValue(null);
    (repository.findByFingerprint as jest.Mock).mockResolvedValue(null);

    await expect(service.findActiveByPlainKey('some-plain-key')).rejects.toThrow(ApiKeyException);
  });

  it('findActiveByPlainKey falls back to DB on Redis error', async () => {
    redisService.raw.get.mockRejectedValue(new Error('Redis connection refused'));
    const dbKey = {
      id: apiKeyId,
      client: 'client',
      key_fingerprint: MOCK_FINGERPRINT,
      permissionCodes: ['ADMIN'],
    };
    (repository.findByFingerprint as jest.Mock).mockResolvedValue(dbKey);

    const result = await service.findActiveByPlainKey('some-plain-key');

    expect(result).toEqual(['ADMIN']);
    expect(logger.warn).toHaveBeenCalledWith(
      'Redis error, falling back to DB',
      expect.objectContaining({ context: 'ApiKeysService' }),
    );
  });

  // ── canDo ───────────────────────────────────────────────────────────

  it('canDo returns true when permission exists', async () => {
    jest.spyOn(service, 'findActiveByPlainKey').mockResolvedValue(['READ']);
    const req: any = { headers: { 'x-api-key': 'PLAINTEXT' } };

    await expect(service.canDo(req, 'READ')).resolves.toBe(true);
  });

  it('canDo returns false when permission missing', async () => {
    jest.spyOn(service, 'findActiveByPlainKey').mockResolvedValue(['WRITE']);
    const req: any = { headers: { 'x-api-key': 'PLAINTEXT' } };

    await expect(service.canDo(req, 'READ')).resolves.toBe(false);
  });

  it('canDo propagates exception when API key invalid', async () => {
    jest
      .spyOn(service, 'findActiveByPlainKey')
      .mockRejectedValue(new ApiKeyException('Invalid', ApiKeyErrorCodes.API_KEY_NOT_FOUND, HttpStatus.NOT_FOUND));
    const req: any = { headers: { 'x-api-key': 'PLAINTEXT' } };

    await expect(service.canDo(req, 'READ')).rejects.toBeInstanceOf(ApiKeyException);
  });

  // ── warmUpCache ─────────────────────────────────────────────────────

  it('warmUpCache loads all active keys into Redis', async () => {
    const activeKeys = [
      {
        id: apiKeyId,
        client: 'client-a',
        key_fingerprint: 'fp-aaa',
        permissionCodes: ['READ'],
      },
      {
        id: secondApiKeyId,
        client: 'client-b',
        key_fingerprint: 'fp-bbb',
        permissionCodes: ['WRITE', 'DELETE'],
      },
    ];
    (repository.findAllActive as jest.Mock).mockResolvedValue(activeKeys);

    await service.warmUpCache();

    expect(multiMock.set).toHaveBeenCalledTimes(2);
    expect(multiMock.set).toHaveBeenCalledWith(
      'api_key:fp:fp-aaa',
      JSON.stringify({ client: 'client-a', permissionCodes: ['READ'] }),
    );
    expect(multiMock.set).toHaveBeenCalledWith(
      'api_key:fp:fp-bbb',
      JSON.stringify({ client: 'client-b', permissionCodes: ['WRITE', 'DELETE'] }),
    );
    expect(multiMock.sAdd).toHaveBeenCalledWith('api_keys', 'fp-aaa');
    expect(multiMock.sAdd).toHaveBeenCalledWith('api_keys', 'fp-bbb');
    expect(multiMock.exec).toHaveBeenCalled();
  });

  it('warmUpCache skips when no active keys exist', async () => {
    (repository.findAllActive as jest.Mock).mockResolvedValue([]);

    await service.warmUpCache();

    expect(redisService.raw.multi).not.toHaveBeenCalled();
  });

  it('warmUpCache logs warning on error', async () => {
    (repository.findAllActive as jest.Mock).mockRejectedValue(new Error('DB error'));

    await service.warmUpCache();

    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to warm up API keys cache',
      expect.objectContaining({ context: 'ApiKeysService' }),
    );
  });

  // ── onModuleInit ────────────────────────────────────────────────────

  it('onModuleInit calls warmUpCache', async () => {
    const warmUpSpy = jest.spyOn(service, 'warmUpCache').mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(warmUpSpy).toHaveBeenCalled();
  });

  it('onModuleInit logs warning if warmUpCache fails', async () => {
    jest.spyOn(service, 'warmUpCache').mockRejectedValue(new Error('cache error'));

    await service.onModuleInit();

    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to warm up API keys cache on init',
      expect.objectContaining({ context: 'ApiKeysService' }),
    );
  });
});

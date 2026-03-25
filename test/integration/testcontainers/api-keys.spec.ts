import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { ApiKeysService } from 'src/services/api-keys/api-keys.service';
import { ApiKeysRepository } from 'src/services/api-keys/api-keys.repository';
import { PermissionsService } from 'src/services/permissions/permissions.service';
import { PermissionsRepository } from 'src/services/permissions/permissions.repository';
import { RedisService } from 'src/common/redis/redis.service';
import { ApiKeyEntity } from 'src/entities/api-key.entity';
import { PermissionEntity } from 'src/entities/permission.entity';
import { CreateApiKeyDTO } from 'src/interfaces/DTO/api-key.dto';
import { entities } from 'src/entities';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

const HMAC_SECRET = 'test-hmac-secret-key-at-least-32-chars';

function computeHmac(plainKey: string): string {
  return createHmac('sha256', HMAC_SECRET).update(plainKey).digest('hex');
}

describe('ApiKeysService (integration)', () => {
  let moduleRef: TestingModule;
  let service: ApiKeysService;
  let permissionsService: PermissionsService;
  let apiKeyRepository: Repository<ApiKeyEntity>;
  let permissionRepository: Repository<PermissionEntity>;
  let dataSource: DataSource;
  let container: StartedPostgreSqlContainer;
  const request = { user: null } as any;

  jest.setTimeout(60000); // 1 minute

  const redisMultiMock = {
    set: jest.fn().mockReturnThis(),
    sAdd: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    sRem: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  };

  const redisServiceMock = {
    raw: {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      sAdd: jest.fn().mockResolvedValue(1),
      sRem: jest.fn().mockResolvedValue(1),
      sMembers: jest.fn().mockResolvedValue([]),
      multi: jest.fn().mockReturnValue(redisMultiMock),
    },
  };

  beforeAll(async () => {
    console.log('Starting PostgreSQL container...');
    container = await new PostgreSqlContainer('postgres:17.6').start();
    console.log('PostgreSQL container started');

    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      entities: [...entities],
      synchronize: true,
    });

    await dataSource.initialize();

    moduleRef = await Test.createTestingModule({
      imports: [],
      providers: [
        ApiKeysService,
        ApiKeysRepository,
        PermissionsService,
        PermissionsRepository,
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue(HMAC_SECRET),
          },
        },
        {
          provide: RedisService,
          useValue: redisServiceMock,
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: {
            warn: jest.fn(),
            error: jest.fn(),
            info: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ApiKeyEntity),
          useValue: dataSource.getRepository(ApiKeyEntity),
        },
        {
          provide: getRepositoryToken(PermissionEntity),
          useValue: dataSource.getRepository(PermissionEntity),
        },
      ],
    }).compile();

    service = moduleRef.get(ApiKeysService);
    permissionsService = moduleRef.get(PermissionsService);

    apiKeyRepository = moduleRef.get(getRepositoryToken(ApiKeyEntity));
    permissionRepository = moduleRef.get(getRepositoryToken(PermissionEntity));
  });

  afterAll(async () => {
    await dataSource.destroy();
    await container.stop();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset the multi mock chain
    redisMultiMock.set.mockReturnThis();
    redisMultiMock.sAdd.mockReturnThis();
    redisMultiMock.del.mockReturnThis();
    redisMultiMock.sRem.mockReturnThis();
    redisMultiMock.exec.mockResolvedValue([]);
    redisServiceMock.raw.get.mockResolvedValue(null);
    redisServiceMock.raw.multi.mockReturnValue(redisMultiMock);
    await dataSource.synchronize(true);
  });

  it('creates an API key with the requested permissions', async () => {
    const permission = await permissionsService.create({ code: 'API_KEYS_CREATE' }, request);

    const payload: CreateApiKeyDTO = {
      client: 'billing-app',
      permissionIds: [permission.id],
    };

    const result = await service.create(payload, request);
    expect(result).toMatchObject({
      client: 'billing-app',
      id: expect.any(String),
      apiKey: expect.any(String),
    });
    expect(result.apiKey).toHaveLength(64); // 32 bytes hex encoded

    const stored = await apiKeyRepository.findOne({
      where: { id: result.id },
      relations: ['permissions'],
    });
    expect(stored).toBeDefined();
    expect(stored?.client).toBe('billing-app');
    expect(stored?.active).toBe(true);
    expect(stored?.permissions.map((p) => p.id)).toEqual([permission.id]);

    // Verify HMAC fingerprint: stored fingerprint matches HMAC of the plain key
    expect(stored?.key_fingerprint).toBe(computeHmac(result.apiKey));
    expect(stored?.key_fingerprint).not.toBe(result.apiKey);
  });

  it('deactivates an API key and persists the change', async () => {
    const permission = await permissionsService.create({ code: 'API_KEYS_DEACTIVATE' }, request);
    const { id } = await service.create(
      {
        client: 'internal-tool',
        permissionIds: [permission.id],
      },
      request,
    );

    const response = await service.deactivate(id);
    expect(response.message).toContain(`API key ${id}`);

    const stored = await apiKeyRepository.findOne({ where: { id } });
    expect(stored?.active).toBe(false);

    // Verify Redis cache was invalidated
    expect(redisServiceMock.raw.multi).toHaveBeenCalled();
    expect(redisMultiMock.del).toHaveBeenCalled();
    expect(redisMultiMock.sRem).toHaveBeenCalled();
    expect(redisMultiMock.exec).toHaveBeenCalled();
  });

  it('validates permissions through canDo using the plain API key', async () => {
    const permission = await permissionsService.create({ code: 'API_KEYS_READ' }, request);
    const { apiKey } = await service.create(
      {
        client: 'reporting-dashboard',
        permissionIds: [permission.id],
      },
      request,
    );

    // Redis returns null (cache miss) → falls back to DB lookup
    redisServiceMock.raw.get.mockResolvedValue(null);

    const canDo = await service.canDo({ headers: { 'x-api-key': apiKey } } as any, permission.code);

    expect(canDo).toBe(true);
  });

  it('returns cached permissions from Redis when available', async () => {
    const permission = await permissionsService.create({ code: 'CACHED_PERM' }, request);
    const { apiKey } = await service.create(
      {
        client: 'cached-client',
        permissionIds: [permission.id],
      },
      request,
    );

    // Simulate a Redis cache hit
    const fingerprint = computeHmac(apiKey);
    redisServiceMock.raw.get.mockResolvedValue(
      JSON.stringify({ client: 'cached-client', permissionCodes: ['CACHED_PERM'] }),
    );

    const permissions = await service.findActiveByPlainKey(apiKey);

    expect(permissions).toEqual(['CACHED_PERM']);
    expect(redisServiceMock.raw.get).toHaveBeenCalledWith(`api_key:fp:${fingerprint}`);
  });

  it('falls back to DB and backfills cache on Redis miss', async () => {
    const permission = await permissionsService.create({ code: 'BACKFILL_PERM' }, request);
    const { apiKey } = await service.create(
      {
        client: 'backfill-client',
        permissionIds: [permission.id],
      },
      request,
    );

    // Redis miss → DB lookup → backfill
    redisServiceMock.raw.get.mockResolvedValue(null);

    const permissions = await service.findActiveByPlainKey(apiKey);

    expect(permissions).toEqual(['BACKFILL_PERM']);
    // Verify backfill was attempted via multi
    expect(redisServiceMock.raw.multi).toHaveBeenCalled();
    expect(redisMultiMock.set).toHaveBeenCalled();
    expect(redisMultiMock.sAdd).toHaveBeenCalled();
  });

  it('findAll returns a paginated response of API keys', async () => {
    const permission = await permissionsService.create({ code: 'FINDALL_PERM' }, request);
    await service.create({ client: 'findall-client', permissionIds: [permission.id] }, request);

    const result = await service.findAll({ page: 1, limit: 20 });

    expect(result.data).toBeDefined();
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.totalPages).toBeGreaterThanOrEqual(1);
    const clients = result.data.map((k) => k.client);
    expect(clients).toContain('findall-client');
  });

  it('findAll returns API keys sorted by client ASC', async () => {
    const permission = await permissionsService.create({ code: 'SORT_PERM' }, request);
    // Create API keys with intentionally out-of-order client names
    await service.create({ client: 'z-client', permissionIds: [permission.id] }, request);
    await service.create({ client: 'a-client', permissionIds: [permission.id] }, request);

    const result = await service.findAll({ page: 1, limit: 20 });

    expect(result.data.length).toBeGreaterThanOrEqual(2);
    const clients = result.data.map((k) => k.client);
    for (let i = 0; i < clients.length - 1; i++) {
      expect(clients[i].localeCompare(clients[i + 1])).toBeLessThanOrEqual(0);
    }
  });
});

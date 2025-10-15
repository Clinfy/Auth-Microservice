import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ApiKeysService } from 'src/services/api-keys/api-keys.service';
import { PermissionsService } from 'src/services/permissions/permissions.service';
import { ApiKeyEntity } from 'src/entities/api-key.entity';
import { PermissionEntity } from 'src/entities/permission.entity';
import { CreateApiKeyDTO } from 'src/interfaces/DTO/api-key.dto';
import { compare } from 'bcrypt';
import {IMemoryDb, newDb, IBackup} from 'pg-mem'
import { entities } from 'src/entities';
import { randomUUID } from 'crypto';

describe('ApiKeysService (integration)', () => {
  let moduleRef: TestingModule;
  let service: ApiKeysService;
  let permissionsService: PermissionsService;
  let apiKeyRepository: Repository<ApiKeyEntity>;
  let permissionRepository: Repository<PermissionEntity>;
  let dataSource: DataSource;
  let db: IMemoryDb;
  let backup: IBackup;
  const request = { user: null } as any;
  beforeAll(async () => {
    db = newDb();

    db.public.registerFunction({
      name: 'current_database',
      implementation: () => 'api_keys_test'
    });

    db.public.registerFunction({
      name: 'version',
      implementation: () => 'PostgreSQL 17.6'
    })

    db.public.registerFunction({
      name: 'uuid_generate_v4',
      implementation: () => randomUUID()
    })

    db.public.registerFunction({
      name: 'gen_random_uuid',
      implementation: () => randomUUID()
    })

    dataSource = await db.adapters.createTypeormDataSource({
      type: 'postgres',
      entities: [...entities],
      synchronize: true
    })

    await dataSource.initialize();

    moduleRef = await Test.createTestingModule({
      imports: [],
      providers: [
        ApiKeysService,
        PermissionsService,
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: getRepositoryToken(ApiKeyEntity),
          useValue: dataSource.getRepository(ApiKeyEntity),
        },
        {
          provide: getRepositoryToken(PermissionEntity),
          useValue: dataSource.getRepository(PermissionEntity),
        }
      ],
    }).compile();

    backup = db.backup();

    service = moduleRef.get(ApiKeysService);
    permissionsService = moduleRef.get(PermissionsService);

    apiKeyRepository = moduleRef.get(getRepositoryToken(ApiKeyEntity));
    permissionRepository = moduleRef.get(getRepositoryToken(PermissionEntity));
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    backup.restore();
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
    expect(stored?.permissions.map(p => p.id)).toEqual([permission.id]);
    expect(stored?.key_hash).not.toBe(result.apiKey);
    expect(await compare(result.apiKey, stored!.key_hash)).toBe(true);
  });

  it('deactivates an API key and persists the change', async () => {
    const permission = await permissionsService.create({ code: 'API_KEYS_DEACTIVATE' }, request);
    const { id } = await service.create({
      client: 'internal-tool',
      permissionIds: [permission.id],
    }, request);

    const response = await service.deactivate(id);
    expect(response.message).toContain(`API key ${id}`);

    const stored = await apiKeyRepository.findOne({ where: { id } });
    expect(stored?.active).toBe(false);
  });

  it('validates permissions through canDo using the plain API key', async () => {
    const permission = await permissionsService.create({ code: 'API_KEYS_READ' }, request);
    const { apiKey } = await service.create({
      client: 'reporting-dashboard',
      permissionIds: [permission.id],
    }, request);

    const canDo = await service.canDo(
      { headers: { 'x-api-key': apiKey } } as any,
      permission.code,
    );

    expect(canDo).toBe(true);
  });
});

import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDTO } from 'src/interfaces/DTO/api-key.dto';
import { ApiKeyEntity } from 'src/entities/api-key.entity';
import { PaginatedResponseDto, PaginationQueryDto } from 'src/interfaces/DTO/pagination.dto';

describe('ApiKeysController', () => {
  let controller: ApiKeysController;
  let service: jest.Mocked<ApiKeysService>;
  const permissionIdOne = '11111111-1111-1111-1111-111111111111';
  const permissionIdTwo = '22222222-2222-2222-2222-222222222222';
  const apiKeyId = '33333333-3333-3333-3333-333333333333';
  const request = {
    user: { id: '55555555-5555-5555-5555-555555555555' },
  } as any;

  beforeEach(() => {
    service = {
      canDo: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
      deactivate: jest.fn(),
    } as unknown as jest.Mocked<ApiKeysService>;

    controller = new ApiKeysController(service);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate canDo to the service', async () => {
    const request = { headers: { 'x-api-key': 'raw-key' } } as any;
    service.canDo.mockResolvedValue(true);

    await expect(controller.canDo(request, 'PERMISSION_CODE')).resolves.toBe(true);
    expect(service.canDo).toHaveBeenCalledWith(request, 'PERMISSION_CODE');
  });

  it('should generate an api key through the service', async () => {
    const dto: CreateApiKeyDTO = {
      client: 'test-client',
      permissionIds: [permissionIdOne, permissionIdTwo],
    };
    const created = {
      apiKey: 'plain-key',
      id: apiKeyId,
      client: 'test-client',
    };
    service.create.mockResolvedValue(created);

    await expect(controller.generate(request, dto)).resolves.toEqual(created);
    expect(service.create).toHaveBeenCalledWith(dto, request);
  });

  it('should return all api keys as a paginated response', async () => {
    const apiKeys = [{ id: apiKeyId } as ApiKeyEntity];
    const query = new PaginationQueryDto();
    const paginated = new PaginatedResponseDto(apiKeys, 1, query.page, query.limit);
    service.findAll.mockResolvedValue(paginated);

    const result = await controller.findAll(query);
    expect(result.data).toEqual(apiKeys);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.totalPages).toBe(1);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('should deactivate an api key via the service', async () => {
    const response = { message: 'done' };
    service.deactivate.mockResolvedValue(response);

    await expect(controller.deactivate(apiKeyId)).resolves.toEqual(response);
    expect(service.deactivate).toHaveBeenCalledWith(apiKeyId);
  });
});

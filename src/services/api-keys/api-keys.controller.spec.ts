import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDTO } from 'src/interfaces/DTO/api-key.dto';
import { ApiKeyEntity } from 'src/entities/api-key.entity';

describe('ApiKeysController', () => {
  let controller: ApiKeysController;
  let service: jest.Mocked<ApiKeysService>;
  const permissionIdOne = '11111111-1111-1111-1111-111111111111';
  const permissionIdTwo = '22222222-2222-2222-2222-222222222222';
  const apiKeyId = '33333333-3333-3333-3333-333333333333';
  const request = { user: { id: '55555555-5555-5555-5555-555555555555' } } as any;

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
    const dto: CreateApiKeyDTO = { client: 'test-client', permissionIds: [permissionIdOne, permissionIdTwo] };
    const created = { apiKey: 'plain-key', id: apiKeyId, client: 'test-client' };
    service.create.mockResolvedValue(created);

    await expect(controller.generate(request, dto)).resolves.toEqual(created);
    expect(service.create).toHaveBeenCalledWith(dto, request);
  });

  it('should return all api keys from the service', async () => {
    const apiKeys = [{ id: apiKeyId } as ApiKeyEntity];
    service.findAll.mockResolvedValue(apiKeys);

    await expect(controller.findAll()).resolves.toEqual(apiKeys);
    expect(service.findAll).toHaveBeenCalledTimes(1);
  });

  it('should deactivate an api key via the service', async () => {
    const response = { message: 'done' };
    service.deactivate.mockResolvedValue(response);

    await expect(controller.deactivate(apiKeyId)).resolves.toEqual(response);
    expect(service.deactivate).toHaveBeenCalledWith(apiKeyId);
  });
});

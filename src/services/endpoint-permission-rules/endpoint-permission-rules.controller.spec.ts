import { EndpointPermissionRulesController } from './endpoint-permission-rules.controller';
import { EndpointPermissionRulesService } from './endpoint-permission-rules.service';
import { EndpointPermissionRulesEntity } from 'src/entities/endpoint-permission-rules.entity';
import { PaginatedResponseDto, PaginationQueryDto } from 'src/interfaces/DTO/pagination.dto';

describe('EndpointPermissionRulesController', () => {
  let controller: EndpointPermissionRulesController;
  let service: jest.Mocked<EndpointPermissionRulesService>;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      assignPermissions: jest.fn(),
      enableRule: jest.fn(),
      disableRule: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<EndpointPermissionRulesService>;

    controller = new EndpointPermissionRulesController(service);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should list all endpoint permission rules as a paginated response', async () => {
    const rules = [{ id: 'rule-1', endpoint_key_name: 'users.create' }] as EndpointPermissionRulesEntity[];
    const query = new PaginationQueryDto();
    const paginated = new PaginatedResponseDto(rules, 1, query.page, query.limit);
    service.findAll.mockResolvedValue(paginated);

    const result = await controller.findAll(query);
    expect(result.data).toEqual(rules);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.totalPages).toBe(1);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });
});

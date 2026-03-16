import { EndpointPermissionRulesController } from './endpoint-permission-rules.controller';
import { EndpointPermissionRulesService } from './endpoint-permission-rules.service';

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
    } as unknown as jest.Mocked<EndpointPermissionRulesService>;

    controller = new EndpointPermissionRulesController(service);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

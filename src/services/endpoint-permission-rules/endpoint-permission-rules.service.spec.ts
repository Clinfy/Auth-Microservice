import { Test, TestingModule } from '@nestjs/testing';
import { EndpointPermissionRulesService } from './endpoint-permission-rules.service';

describe('EndpointPermissionRulesService', () => {
  let service: EndpointPermissionRulesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EndpointPermissionRulesService],
    }).compile();

    service = module.get<EndpointPermissionRulesService>(EndpointPermissionRulesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

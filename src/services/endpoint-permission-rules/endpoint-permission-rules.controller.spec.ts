import { Test, TestingModule } from '@nestjs/testing';
import { EndpointPermissionRulesController } from './endpoint-permission-rules.controller';

describe('EndpointPermissionRulesController', () => {
  let controller: EndpointPermissionRulesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EndpointPermissionRulesController],
    }).compile();

    controller = module.get<EndpointPermissionRulesController>(EndpointPermissionRulesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

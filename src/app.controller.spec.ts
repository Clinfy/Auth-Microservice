import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: { getStatus: jest.Mock<string, []> };

  beforeEach(async () => {
    appService = {
      getStatus: jest.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: appService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('should be defined', () => {
    expect(appController).toBeDefined();
  });

  it('should return the status provided by the service', () => {
    appService.getStatus.mockReturnValue('system ok');

    const result = appController.status();

    expect(appService.getStatus).toHaveBeenCalledTimes(1);
    expect(result).toBe('system ok');
  });
});

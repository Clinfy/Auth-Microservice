import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppModule } from 'src/app.module';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Status information"', () => {
      expect(appController.status()).toBe(`
        status: ok | 
        name: ${process.env.npm_package_name} |
        version: ${process.env.npm_package_version} |
        node: ${process.version} | 
        uptime: ${Math.floor(process.uptime())} secs | 
        memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB |
        now: ${new Date().toISOString()}
        `);
    });
  });
});

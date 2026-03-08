import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Status')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOperation({ summary: 'Get service status' })
  @ApiOkResponse({ schema: { type: 'string' } })
  @Get()
  status(): string {
    return this.appService.getStatus();
  }
}

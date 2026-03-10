import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
import { MetricsGuard } from './metrics.guard';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @UseGuards(MetricsGuard)
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiExcludeEndpoint() // Exclude from Swagger docs in production
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }
}

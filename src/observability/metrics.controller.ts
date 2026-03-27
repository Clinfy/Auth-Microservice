import { Controller, Get, NotFoundException, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { MetricsService } from './metrics.service.js';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import { EndpointKey } from 'src/common/decorators/endpoint-key.decorator';

@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @UseGuards(ApiKeyGuard)
  @EndpointKey('metrics.get')
  async getMetrics(@Res() res: Response) {
    const enabled = this.config.get<boolean>('METRICS_ENABLED', true);

    if (!enabled) {
      throw new NotFoundException('Metrics endpoint is disabled');
    }

    const metrics = await this.metricsService.getMetrics();
    res.set('Content-Type', this.metricsService.getContentType());
    res.end(metrics);
  }
}

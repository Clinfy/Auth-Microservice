import { Global, Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { MetricsGuard } from './metrics.guard';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, MetricsGuard],
  exports: [MetricsService],
})
export class ObservabilityModule {}

import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsService } from './metrics.service.js';
import { MetricsController } from './metrics.controller.js';
import { HttpMetricsInterceptor } from './http-metrics.interceptor.js';

@Global()
@Module({
    controllers: [MetricsController],
    providers: [
        MetricsService,
        {
            provide: APP_INTERCEPTOR,
            useClass: HttpMetricsInterceptor,
        },
    ],
    exports: [MetricsService],
})
export class ObservabilityModule { }

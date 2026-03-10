import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class MetricsGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const metricsEnabled = this.configService.get<boolean>('METRICS_ENABLED', true);

    if (!metricsEnabled) {
      throw new UnauthorizedException('Metrics endpoint is disabled');
    }

    const metricsApiKey = this.configService.get<string>('METRICS_API_KEY');

    // If no API key is configured, allow access (for local development)
    if (!metricsApiKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = this.extractApiKey(request);

    if (!providedKey || providedKey !== metricsApiKey) {
      throw new UnauthorizedException('Invalid or missing metrics API key');
    }

    return true;
  }

  private extractApiKey(request: Request): string | undefined {
    // Check Authorization header (Bearer token)
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check X-Metrics-Key header
    const metricsKeyHeader = request.headers['x-metrics-key'];
    if (typeof metricsKeyHeader === 'string') {
      return metricsKeyHeader;
    }

    // Check query parameter
    const queryKey = request.query['api_key'];
    if (typeof queryKey === 'string') {
      return queryKey;
    }

    return undefined;
  }
}

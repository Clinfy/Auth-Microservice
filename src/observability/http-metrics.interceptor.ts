import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';
import type { Request, Response } from 'express';

// Routes to exclude from metrics to avoid skewing dashboards
const EXCLUDED_ROUTES = ['/metrics', '/docs', '/docs-json', '/docs-yaml'];

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    // Skip excluded routes
    if (EXCLUDED_ROUTES.some((route) => request.path.startsWith(route))) {
      return next.handle();
    }

    const startTime = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => {
          this.recordMetrics(request, response.statusCode, startTime);
        },
        error: () => {
          // On error, status code might not be set yet, use 500 as fallback
          const statusCode = response.statusCode >= 400 ? response.statusCode : 500;
          this.recordMetrics(request, statusCode, startTime);
        },
      }),
    );
  }

  private recordMetrics(request: Request, statusCode: number, startTime: bigint): void {
    const endTime = process.hrtime.bigint();
    const durationNs = Number(endTime - startTime);
    const durationSeconds = durationNs / 1e9;

    const method = request.method;
    const route = this.normalizeRoute(request);

    this.metricsService.recordHttpRequest(method, route, statusCode, durationSeconds);
  }

  /**
   * Normalize route to use path templates instead of raw URLs
   * This prevents high cardinality from dynamic segments like IDs
   */
  private normalizeRoute(request: Request): string {
    // Use the matched route pattern if available (from Express/NestJS router)
    const routePattern = request.route?.path;
    if (routePattern) {
      return routePattern;
    }

    // Fallback: normalize common dynamic segments
    // Replace UUIDs
    let normalized = request.path.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ':id',
    );

    // Replace numeric IDs
    normalized = normalized.replace(/\/\d+(?=\/|$)/g, '/:id');

    return normalized || '/';
  }
}

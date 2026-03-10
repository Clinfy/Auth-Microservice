import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { MetricsService } from './metrics.service.js';

/** Routes excluded from HTTP business metrics. */
const EXCLUDED_PREFIXES = ['/metrics', '/docs'];

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
    constructor(private readonly metrics: MetricsService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const http = context.switchToHttp();
        const req = http.getRequest<Request>();
        const route = this.resolveRoute(req);

        if (EXCLUDED_PREFIXES.some((prefix) => route.startsWith(prefix))) {
            return next.handle();
        }

        const start = performance.now();

        return next.handle().pipe(
            tap({
                next: () => this.record(req.method, route, http.getResponse<Response>().statusCode, start),
                error: (err) => {
                    const status = err?.status ?? err?.getStatus?.() ?? 500;
                    this.record(req.method, route, status, start);
                },
            }),
        );
    }

    private record(method: string, route: string, statusCode: number, start: number) {
        const duration = (performance.now() - start) / 1000;
        const labels = {
            method,
            route,
            status_code: String(statusCode),
        };

        this.metrics.httpRequestsTotal.inc(labels);
        this.metrics.httpRequestDuration.observe(labels, duration);
    }

    /**
     * Resolves the route template (`/users/:id`) instead of raw URL
     * to keep cardinality low.
     */
    private resolveRoute(req: Request): string {
        // Express populates req.route when matched through the router
        if (req.route?.path) {
            const basePath = req.baseUrl || '';
            return `${basePath}${req.route.path}`;
        }
        // Fallback: use the path without query string
        return req.path || req.url?.split('?')[0] || 'unknown';
    }
}

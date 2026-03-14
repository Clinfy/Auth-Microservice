import { Injectable, OnModuleInit } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Gauge, Histogram, register } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  // ── HTTP metrics ──────────────────────────────────────────────
  readonly httpRequestsTotal = new Counter({
    name: 'auth_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'] as const,
  });

  readonly httpRequestDuration = new Histogram({
    name: 'auth_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  });

  // ── Dependency metrics ────────────────────────────────────────
  readonly dependencyDuration = new Histogram({
    name: 'auth_dependency_duration_seconds',
    help: 'Duration of external dependency calls in seconds',
    labelNames: ['dependency', 'operation', 'result'] as const,
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  });

  readonly dependencyErrorsTotal = new Counter({
    name: 'auth_dependency_errors_total',
    help: 'Total number of dependency errors',
    labelNames: ['dependency', 'operation', 'error_type'] as const,
  });

  // ── Outbox metrics ────────────────────────────────────────────
  readonly outboxBatchSize = new Gauge({
    name: 'auth_outbox_batch_size',
    help: 'Number of pending outbox events processed per batch',
  });

  onModuleInit() {
    collectDefaultMetrics({ prefix: 'auth_' });
  }

  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  getContentType(): string {
    return register.contentType;
  }

  /**
   * Records the duration and result of a dependency call.
   */
  async recordDependencyCall<T>(dependency: string, operation: string, fn: () => Promise<T>): Promise<T> {
    const end = this.dependencyDuration.startTimer({
      dependency,
      operation,
    });

    try {
      const result = await fn();
      end({ result: 'success' });
      return result;
    } catch (error) {
      end({ result: 'error' });
      this.dependencyErrorsTotal.inc({
        dependency,
        operation,
        error_type: error instanceof Error ? error.constructor.name : 'Unknown',
      });
      throw error;
    }
  }
}

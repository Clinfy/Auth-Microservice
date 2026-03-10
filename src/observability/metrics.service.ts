import { Injectable } from '@nestjs/common';
import {
  metricsRegistry,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  dbQueryDurationSeconds,
  dbErrorsTotal,
  redisOperationDurationSeconds,
  redisErrorsTotal,
  rmqOperationDurationSeconds,
  rmqErrorsTotal,
  rmqOutboxBacklog,
  jwtOperationDurationSeconds,
  jwtErrorsTotal,
  authAttemptsTotal,
} from './metrics.registry';

type DependencyType = 'db' | 'redis' | 'rmq' | 'jwt';
type OperationResult = 'success' | 'error';

@Injectable()
export class MetricsService {
  // ============================================================================
  // HTTP Metrics
  // ============================================================================

  recordHttpRequest(method: string, route: string, statusCode: number, durationSeconds: number): void {
    const labels = { method, route, status_code: String(statusCode) };
    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationSeconds);
  }

  // ============================================================================
  // Dependency Metrics
  // ============================================================================

  recordDependencyOperation(
    dependency: DependencyType,
    operation: string,
    result: OperationResult,
    durationSeconds: number,
  ): void {
    const labels = { operation, result };

    switch (dependency) {
      case 'db':
        dbQueryDurationSeconds.observe(labels, durationSeconds);
        break;
      case 'redis':
        redisOperationDurationSeconds.observe(labels, durationSeconds);
        break;
      case 'rmq':
        rmqOperationDurationSeconds.observe(labels, durationSeconds);
        break;
      case 'jwt':
        jwtOperationDurationSeconds.observe(labels, durationSeconds);
        break;
    }
  }

  recordDependencyError(dependency: DependencyType, operation: string, errorType: string): void {
    const labels = { operation, error_type: errorType };

    switch (dependency) {
      case 'db':
        dbErrorsTotal.inc(labels);
        break;
      case 'redis':
        redisErrorsTotal.inc(labels);
        break;
      case 'rmq':
        rmqErrorsTotal.inc(labels);
        break;
      case 'jwt':
        jwtErrorsTotal.inc(labels);
        break;
    }
  }

  // ============================================================================
  // Outbox Metrics
  // ============================================================================

  setOutboxBacklog(destination: string, count: number): void {
    rmqOutboxBacklog.set({ destination }, count);
  }

  // ============================================================================
  // Auth Metrics
  // ============================================================================

  recordAuthAttempt(result: 'success' | 'failure'): void {
    authAttemptsTotal.inc({ result });
  }

  // ============================================================================
  // Registry Access
  // ============================================================================

  async getMetrics(): Promise<string> {
    return metricsRegistry.metrics();
  }

  getContentType(): string {
    return metricsRegistry.contentType;
  }
}

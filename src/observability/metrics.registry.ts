import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Single registry instance to avoid duplicate metrics
export const metricsRegistry = new Registry();

// Set default labels for all metrics
metricsRegistry.setDefaultLabels({
  service: 'auth',
});

// Collect default metrics (CPU, memory, event loop, etc.)
collectDefaultMetrics({ register: metricsRegistry, prefix: 'auth_' });

// ============================================================================
// HTTP Metrics
// ============================================================================

export const httpRequestsTotal = new Counter({
  name: 'auth_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [metricsRegistry],
});

export const httpRequestDurationSeconds = new Histogram({
  name: 'auth_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

// ============================================================================
// Dependency Metrics - Database (PostgreSQL/TypeORM)
// ============================================================================

export const dbQueryDurationSeconds = new Histogram({
  name: 'auth_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'result'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [metricsRegistry],
});

export const dbErrorsTotal = new Counter({
  name: 'auth_db_errors_total',
  help: 'Total number of database errors',
  labelNames: ['operation', 'error_type'] as const,
  registers: [metricsRegistry],
});

// ============================================================================
// Dependency Metrics - Redis
// ============================================================================

export const redisOperationDurationSeconds = new Histogram({
  name: 'auth_redis_operation_duration_seconds',
  help: 'Duration of Redis operations in seconds',
  labelNames: ['operation', 'result'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
  registers: [metricsRegistry],
});

export const redisErrorsTotal = new Counter({
  name: 'auth_redis_errors_total',
  help: 'Total number of Redis errors',
  labelNames: ['operation', 'error_type'] as const,
  registers: [metricsRegistry],
});

// ============================================================================
// Dependency Metrics - RabbitMQ
// ============================================================================

export const rmqOperationDurationSeconds = new Histogram({
  name: 'auth_rmq_operation_duration_seconds',
  help: 'Duration of RabbitMQ operations in seconds',
  labelNames: ['operation', 'result'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [metricsRegistry],
});

export const rmqErrorsTotal = new Counter({
  name: 'auth_rmq_errors_total',
  help: 'Total number of RabbitMQ errors',
  labelNames: ['operation', 'error_type'] as const,
  registers: [metricsRegistry],
});

export const rmqOutboxBacklog = new Gauge({
  name: 'auth_rmq_outbox_backlog',
  help: 'Number of pending events in the outbox',
  labelNames: ['destination'] as const,
  registers: [metricsRegistry],
});

// ============================================================================
// JWT/Auth Metrics
// ============================================================================

export const jwtOperationDurationSeconds = new Histogram({
  name: 'auth_jwt_operation_duration_seconds',
  help: 'Duration of JWT operations in seconds',
  labelNames: ['operation', 'result'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1],
  registers: [metricsRegistry],
});

export const jwtErrorsTotal = new Counter({
  name: 'auth_jwt_errors_total',
  help: 'Total number of JWT errors',
  labelNames: ['operation', 'error_type'] as const,
  registers: [metricsRegistry],
});

// ============================================================================
// Business Metrics
// ============================================================================

export const authAttemptsTotal = new Counter({
  name: 'auth_login_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['result'] as const,
  registers: [metricsRegistry],
});

export const activeSessionsGauge = new Gauge({
  name: 'auth_active_sessions',
  help: 'Number of active user sessions',
  registers: [metricsRegistry],
});

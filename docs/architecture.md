# Architecture Overview

Technical architecture documentation for the Auth-Microservice.

## Table of Contents

- [Module Structure](#module-structure)
- [Request Lifecycle](#request-lifecycle)
- [Error Handling Architecture](#error-handling-architecture)
- [Cron Jobs](#cron-jobs)
- [External Dependencies](#external-dependencies)
- [Key Design Decisions](#key-design-decisions)

---

## Module Structure

![Module Structure](diagrams/module-structure.puml)

### Dependency Rules

- **No circular dependencies**: `SessionsModule` accesses `UserRepository` directly (read-only) instead of depending on `UsersModule`, avoiding `forwardRef()`.
- **Lazy resolution**: `AuthGuard` and `MicroserviceGuard` use `ModuleRef.get({ strict: false })` to resolve `EndpointPermissionRulesService` lazily, avoiding static module import cycles.
- **Global modules**: `ConfigModule` and `RedisModule` are available globally.

---

## Request Lifecycle

Every incoming HTTP request passes through this pipeline:

![Request Lifecycle Pipeline](diagrams/request-lifecycle.puml)

### Guard Architecture

![Guard Architecture](diagrams/guard-architecture.puml)

---

## Error Handling Architecture

### Exception Hierarchy

![Exception Hierarchy](diagrams/exception-hierarchy.puml)

### Cause Chaining Pattern

Service catch blocks wrap the original error as `cause`:

```typescript
catch (error) {
  throw new RolesException(
    'Permission assignment failed',
    RolesErrorCodes.ROLES_ASSIGN_ERROR,
    error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
    error,  // ← original error preserved as cause
  );
}
```

### AllExceptionsFilter Processing

![AllExceptionsFilter Processing](diagrams/all-exceptions-filter-processing.puml)

The filter traverses the full cause chain:

1. **User message**: Extracted from the deepest `HttpException` in the chain — shows the most specific message (e.g., "Permission with ID abc not found" instead of generic "Permission assignment failed").
2. **Error code**: The top-level exception's `errorCode` (e.g., `ROLE_PERMISSION_ASSIGN_ERROR`).
3. **Cause code**: The deepest `BaseServiceException`'s `errorCode`, only included when different from the top-level code (e.g., `PERMISSION_NOT_FOUND`).
4. **Logging**: Full cause chain array, stack trace, HTTP metadata, all logged to Winston.

### Response Format

```json
{
  "statusCode": 400,
  "timestamp": "2026-03-18T12:00:00.000Z",
  "path": "/roles/123/permissions",
  "errorCode": "ROLE_PERMISSION_ASSIGN_ERROR",
  "causeCode": "PERMISSION_NOT_FOUND",
  "message": "Permission with ID abc not found"
}
```

### serializeError Utility

`src/common/utils/logger-format.util.ts` provides a recursive error serializer used throughout the codebase for structured Winston logging. It handles nested `Error.cause` chains and `HttpException` response details.

### Validation Errors

The global `ValidationPipe` uses a custom `exceptionFactory` that:

- Extracts the first `errorCode` from validation constraints (if custom validators provide one).
- Falls back to `VALIDATION_ERROR` as the default code.
- Returns a `BadRequestException` with the structured error format.

---

## Cron Jobs

All cron jobs are registered as providers in `AppModule`:

| Service                         | Schedule     | Description                                                                    |
| ------------------------------- | ------------ | ------------------------------------------------------------------------------ |
| `OutboxPublisherService`        | Every 10 sec | Reads pending events from `outbox` table, publishes to RabbitMQ, marks as sent |
| `OutboxSubscriberService`       | Startup      | Consumes events from RabbitMQ audit queue                                      |
| `EprCacheReconciliationService` | Every hour   | Deletes stale EPR Redis keys, re-warms cache from DB                           |

### Outbox Pattern

![Outbox Pattern](diagrams/outbox-pattern.puml)

Audit events are persisted to the `outbox` PostgreSQL table transactionally with the business operation. A cron job then publishes them to RabbitMQ asynchronously. This ensures at-least-once delivery even if RabbitMQ is temporarily unavailable.

### EPR Cache Reconciliation

![EPR Cache Reconciliation](diagrams/epr-cache-reconciliation.puml)

Runs hourly to handle edge cases (Redis restarts, missed invalidations, manual DB edits):

1. Reads all tracked keys from the `epr_keys` Redis set.
2. Deletes all `epr:*` keys and the tracking set via `multi()` pipeline.
3. Calls `warmUpCache()` to reload all enabled rules from PostgreSQL.

All operations use structured Winston logging with `serializeError()` for failures.

---

## External Dependencies

![External Dependencies](diagrams/external-dependencies.puml)

### PostgreSQL (via TypeORM)

Source of truth for all entities. Uses `synchronize: true` (schema auto-sync from entities). Entities:

- `UserEntity`, `RoleEntity`, `PermissionEntity`, `ApiKeyEntity`
- `EndpointPermissionRulesEntity`, `OutboxEntity`

### Redis

- **Sessions**: `auth_session:{sid}` — JSON session data with TTL.
- **Session tracking**: `user_sessions:{userId}` — set of active session IDs.
- **EPR cache**: `epr:{endpoint_key_name}` — JSON array of permission codes.
- **EPR key tracking**: `epr_keys` — set of all cached endpoint key names (for reconciliation).

All Redis operations are resilient — failures are caught, logged, and the service falls back to PostgreSQL.

### RabbitMQ

- **Audit queue** (`audit_queue`): Receives audit events from the outbox publisher.
- **Email client**: Publishes email requests (password reset, etc.) to a dedicated queue.

---

## Key Design Decisions

### Cookie-Only Frontend Authentication

Tokens are delivered exclusively via HTTP-only, secure, strict-sameSite cookies. Bearer tokens are reserved for inter-service communication. See [authentication-flow.md](./authentication-flow.md) for details.

### Dynamic Permissions Over Decorators

Instead of hardcoded `@Permissions(['USERS_READ'])` decorators, all authorization is driven by database rules looked up via `@EndpointKey`. This allows runtime permission changes without redeployment.

### Fail-Closed Security Model

If an endpoint has `@EndpointKey` but no corresponding rule in the database, access is denied (not granted). This prevents accidental exposure when a developer forgets to create the rule.

### Real-Time Permission Propagation

Permission changes are propagated immediately to all affected Redis sessions within the same request transaction, rather than relying on eventual consistency (cron, polling, or token refresh).

### Outbox Pattern for Audit Events

Audit events are written to PostgreSQL transactionally with the business operation, then asynchronously published to RabbitMQ. This decouples audit delivery from request latency and guarantees at-least-once delivery.

### Lazy Guard Dependencies

Guards use `ModuleRef.get({ strict: false })` with cached instances to resolve service dependencies lazily. This avoids circular module imports without `forwardRef()`.

### BaseServiceException with ES2022 Cause

Every service exception extends `BaseServiceException` with native `Error.cause` support. This preserves the full error context through catch-and-rethrow chains while surfacing the most specific user-facing message.

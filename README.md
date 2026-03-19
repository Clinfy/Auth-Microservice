# Clinfy Auth Microservice

> Authentication, authorization, and user-management microservice built with **NestJS 11**, **TypeScript**, and **PostgreSQL**.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Authentication Flow](#authentication-flow)
  - [Cookie-Based JWT (Frontend)](#cookie-based-jwt-frontend)
  - [Inter-Service Authentication (MicroserviceGuard)](#inter-service-authentication-microserviceguard)
- [Dynamic Endpoint Permissions](#dynamic-endpoint-permissions)
  - [Security Behavior: Fail-Closed](#security-behavior-fail-closed-by-design)
  - [EPR Cache Reconciliation](#epr-cache-reconciliation)
- [Error Handling](#error-handling)
- [Getting Started](#getting-started)
  - [Database Seeding](#database-seeding-required-for-first-run)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Observability](#observability)
- [Testing](#testing)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)

---

## Overview

This microservice is responsible for managing:

- **Users** — registration, activation/deactivation, login/logout, password reset, and role assignment.
- **Roles** — CRUD and permission grouping.
- **Permissions** — fine-grained access control with unique permission codes.
- **API Keys** — key-based authentication for service-to-service communication.
- **Sessions** — active session tracking per user in Redis, with real-time permission refresh.
- **JWT** — access & refresh token generation, validation, and rotation via HTTP-only cookies.
- **Dynamic Endpoint Permissions** — database-driven, Redis-cached permission rules per endpoint.
- **Audit Logging** — event publishing via RabbitMQ outbox pattern.

## Tech Stack

| Layer         | Technology                              |
| ------------- | --------------------------------------- |
| Framework     | NestJS 11                               |
| Language      | TypeScript 5                            |
| Runtime       | Node.js 24                              |
| Database      | PostgreSQL (TypeORM)                    |
| Cache         | Redis                                   |
| Messaging     | RabbitMQ (via `@nestjs/microservices`)  |
| Auth          | JWT (`jsonwebtoken`) + bcrypt + cookies |
| Logging       | Winston (`nest-winston`)                |
| Metrics       | Prometheus (`prom-client`)              |
| Visualization | Grafana                                 |
| API Docs      | Swagger (`@nestjs/swagger`)             |
| Validation    | `class-validator` + `class-transformer` |
| Scheduling    | `@nestjs/schedule`                      |

## Architecture

![High-Level Architecture](docs/diagrams/high-level-architecture.puml)

### Key Patterns

- **Cookie-based JWT** — access and refresh tokens are delivered exclusively via HTTP-only cookies (`auth_token`, `refresh_token`). Tokens are never returned in response bodies.
- **Dual authentication for inter-service calls** — endpoints consumed by other microservices (`/users/me`, `/users/can-do/:permission`) require both an API key (`x-api-key` header) and a Bearer token (`Authorization` header) via the `MicroserviceGuard`.
- **Dynamic endpoint permissions** — every guarded endpoint is tagged with `@EndpointKey`, and its required permissions are stored in PostgreSQL / cached in Redis. Permissions can be changed at runtime via the API without redeployment.
- **Outbox pattern** — audit events are persisted to an `outbox` table and published to RabbitMQ every 10 s by a cron job, ensuring at-least-once delivery.
- **Real-time permission refresh** — when roles or user-role assignments change, all active Redis sessions for affected users are updated immediately within the same request.
- **EPR cache reconciliation** — an hourly cron job reconciles Redis EPR cache with PostgreSQL, deleting stale keys and re-warming the cache.
- **Request Context** — a middleware injects per-request metadata (IP, user-agent) available throughout the request lifecycle.
- **BaseServiceException + cause chaining** — all service exceptions extend `BaseServiceException` with ES2022 `Error.cause` support. The `AllExceptionsFilter` traverses the cause chain to surface the most specific user-facing message.
- **Environment Validation** — startup fails fast if required environment variables are missing or malformed (`class-validator` schema in `src/config/env-validation.ts`).

---

## Authentication Flow

### Cookie-Based JWT (Frontend)

All browser-facing authentication uses HTTP-only cookies. Tokens are **never** returned in response bodies — the frontend has zero access to raw tokens from JavaScript.

#### Login

![Login Flow](docs/diagrams/login-flow-compact.puml)

#### Token Refresh

![Token Refresh Flow](docs/diagrams/token-refresh-compact.puml)

#### Logout

![Logout Flow](docs/diagrams/logout-compact.puml)

#### Cookie Configuration

| Cookie          | Flags                                                                    | Scope                         |
| --------------- | ------------------------------------------------------------------------ | ----------------------------- |
| `auth_token`    | `httpOnly`, `secure`\*, `sameSite: strict`, `path: /`                    | Sent with every request       |
| `refresh_token` | `httpOnly`, `secure`\*, `sameSite: strict`, `path: /users/refresh-token` | Sent only to refresh endpoint |

\* `secure` is controlled by the `COOKIE_SECURE` env var (`false` only for local development without HTTPS).

#### CSRF Protection

With `sameSite: strict`, cookies are **never** sent on cross-origin requests of any kind (GET, POST, fetch, form submissions). This eliminates all CSRF vectors without requiring an additional CSRF token.

### Inter-Service Authentication (MicroserviceGuard)

Endpoints consumed by other microservices use **dual authentication** — both the calling service and the end user must be authenticated:

![Inter-Service Auth Flow](docs/diagrams/inter-service-auth-compact.puml)

**How it works:**

1. The browser sends a request to another microservice (e.g., Audit-MS). The `auth_token` cookie travels automatically.
2. The other microservice extracts the token from the cookie.
3. The other microservice calls Auth-MS with:
   - `x-api-key: <service_api_key>` — identifies the calling microservice.
   - `Authorization: Bearer <user_token>` — identifies the end user.
4. Auth-MS validates both: API key (is this an authorized service?) then Bearer token (valid JWT, active Redis session).
5. **No IP/subnet check** on the Bearer token — the request originates from the microservice, not the user's browser.

**Affected endpoints:**

| Endpoint                        | Purpose                                 |
| ------------------------------- | --------------------------------------- |
| `GET /users/me`                 | Get authenticated user info             |
| `GET /users/can-do/:permission` | Check if user has a specific permission |

**Guards:**

| Guard               | Auth Mechanism          | Used By                                                |
| ------------------- | ----------------------- | ------------------------------------------------------ |
| `AuthGuard`         | Cookie (`auth_token`)   | All browser-facing protected endpoints                 |
| `MicroserviceGuard` | API key + Bearer header | Inter-service endpoints (`me`, `can-do`)               |
| `ApiKeyGuard`       | `x-api-key` header      | Service-only endpoints (register, metrics, EPR lookup) |

### Real-Time Permission Refresh

When an admin changes a user's roles or a role's permissions, **all active Redis sessions** for affected users are updated immediately:

- `UsersService.assignRole()` → calls `SessionsService.refreshSessionPermissions()` for the specific user.
- `RolesService.assignPermissions()` → calls `SessionsService.refreshSessionPermissionsByRole()` which finds all users with that role and updates their sessions.

This means permission changes take effect **instantly** without requiring users to re-login or wait for a token refresh.

---

## Dynamic Endpoint Permissions

### Overview

The **Dynamic Endpoint Permissions** system allows changing which permissions an endpoint requires **at runtime**, without code changes or redeployment. Each controller method is tagged with an `@EndpointKey('unique.key')` decorator, and permission rules for those keys are managed via the API, stored in PostgreSQL, and cached in Redis.

### How It Works — Permission Resolution

The `AuthGuard` resolves required permissions using a lookup chain:

![Dynamic Endpoint Permission Resolution](docs/diagrams/dynamic-permission-resolution.puml)

1. **Dynamic rule lookup** — If the endpoint has `@EndpointKey`, the guard queries `EndpointPermissionRulesService` for that key. If an enabled rule exists, its permission list is enforced against the user's session permissions.
2. **No matching rule** — If `@EndpointKey` is present but no rule exists in the DB, access is **denied**. This fail-closed design prevents accidental exposure of unprotected endpoints.

### The `@EndpointKey` Decorator

A thin metadata decorator built with NestJS `Reflector`:

```ts
// src/common/decorators/endpoint-key.decorator.ts
import { Reflector } from '@nestjs/core';

export const EndpointKey = Reflector.createDecorator<string>();
```

#### Security Behavior: Fail-Closed by Design

The `@EndpointKey` system implements a **fail-closed** security model. This is an intentional design decision to prevent accidentally exposing sensitive endpoints:

| Scenario                                        | Behavior                                                                                                    |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `@EndpointKey` present + rule exists + enabled  | Permission check enforced                                                                                   |
| `@EndpointKey` present + rule exists + disabled | Access denied (rule is inactive)                                                                            |
| `@EndpointKey` present + **no rule in DB**      | **Access denied** (HTTP 404: "endpoint does not have a permission rule defined and is temporally disabled") |
| No `@EndpointKey` decorator                     | Access allowed (endpoint not protected by dynamic rules)                                                    |

**Why this matters**: When a developer adds `@EndpointKey('some.key')` to an endpoint but forgets to create the corresponding rule in the database, the endpoint becomes **inaccessible** rather than unprotected. This prevents security gaps caused by missing configuration.

**Implementation**: See `src/services/endpoint-permission-rules/endpoint-permission-rules.service.ts` — the `getPermissionsForEndpoint()` method throws an exception when no rule is found for a registered endpoint key.

#### Usage

Place `@EndpointKey` on any guarded controller method:

```ts
@UseGuards(AuthGuard)
@EndpointKey('roles.create')
@Post('new')
create(@Body() dto: CreateRoleDTO): Promise<RoleEntity> {
  return this.rolesService.create(dto);
}
```

#### Key Naming Convention

Keys follow a `<domain>.<action>` pattern. Related endpoints share the same key when they require the same level of access:

| Key                                  | Endpoints                                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `users.register`                     | `POST /users/register`                                                                             |
| `users.update`                       | `POST /users/activate/:id`, `POST /users/deactivate/:id`, `POST /users/assign-role/:id`            |
| `users.find`                         | `GET /users/all`                                                                                   |
| `users.find_api`                     | `GET /users/me`, `GET /users/can-do/:permission`                                                   |
| `roles.create`                       | `POST /roles/new`                                                                                  |
| `roles.update`                       | `PATCH /roles/edit/:id`, `PATCH /roles/assign-permissions/:id`                                     |
| `roles.delete`                       | `DELETE /roles/delete/:id`                                                                         |
| `roles.find`                         | `GET /roles/find/:id`, `GET /roles/all`                                                            |
| `permission.create`                  | `POST /permissions/new`                                                                            |
| `permission.update`                  | `PATCH /permissions/edit/:id`                                                                      |
| `permission.delete`                  | `DELETE /permissions/delete/:id`                                                                   |
| `permission.find`                    | `GET /permissions/find/:id`, `GET /permissions/all`                                                |
| `api-key.generate`                   | `POST /api-keys/generate`                                                                          |
| `api-key.find`                       | `GET /api-keys/all`                                                                                |
| `api-key.deactivate`                 | `PATCH /api-keys/deactivate/:id`                                                                   |
| `sessions.find`                      | `GET /sessions/user/:userId`                                                                       |
| `sessions.deactivate`                | `POST /sessions/deactivate/:sid`                                                                   |
| `endpoint-permission-rules.create`   | `POST /endpoint-permission-rules/new`                                                              |
| `endpoint-permission-rules.update`   | `PATCH /endpoint-permission-rules/edit/:id`, `enable/:id`, `disable/:id`, `assign-permissions/:id` |
| `endpoint-permission-rules.delete`   | `DELETE /endpoint-permission-rules/delete/:id`                                                     |
| `endpoint-permission-rules.find`     | `GET /endpoint-permission-rules/all`, `find/:id`                                                   |
| `endpoint-permission-rules.find_api` | `GET /endpoint-permission-rules/get-endpoint-permissions/:key`                                     |
| `metrics.get`                        | `GET /metrics`                                                                                     |

### Data Model — `EndpointPermissionRulesEntity`

Stored in the `endpoint_permission_rules` table:

| Column              | Type                            | Description                                 |
| ------------------- | ------------------------------- | ------------------------------------------- |
| `id`                | UUID (PK)                       | Auto-generated identifier                   |
| `endpoint_key_name` | string (unique)                 | Matches the value passed to `@EndpointKey`  |
| `enabled`           | boolean                         | Whether the rule is active (default `true`) |
| `permissions`       | ManyToMany → `PermissionEntity` | Permission codes required for this endpoint |
| `created_at`        | timestamp                       | Creation time                               |
| `updated_at`        | timestamp                       | Last modification time                      |
| `created_by`        | jsonb                           | The `AuthUser` who created the rule         |

A computed getter `permissionCodes` returns `string[]` of permission codes from the related entities.

### Managing Rules via the API

All CRUD operations are exposed under `/endpoint-permission-rules`:

| Method   | Path                                                       | Description                                       |
| -------- | ---------------------------------------------------------- | ------------------------------------------------- |
| `POST`   | `/endpoint-permission-rules/new`                           | Create a new rule                                 |
| `PATCH`  | `/endpoint-permission-rules/edit/:id`                      | Update rule fields                                |
| `PATCH`  | `/endpoint-permission-rules/assign-permissions/:id`        | Assign permissions to a rule                      |
| `PATCH`  | `/endpoint-permission-rules/enable/:id`                    | Enable a rule                                     |
| `PATCH`  | `/endpoint-permission-rules/disable/:id`                   | Disable a rule                                    |
| `DELETE` | `/endpoint-permission-rules/delete/:id`                    | Delete a rule                                     |
| `GET`    | `/endpoint-permission-rules/all`                           | List all rules                                    |
| `GET`    | `/endpoint-permission-rules/find/:id`                      | Get a rule by ID                                  |
| `GET`    | `/endpoint-permission-rules/get-endpoint-permissions/:key` | Get resolved permissions for a key (API Key auth) |

### Redis Caching

Permissions are cached in Redis under the key `epr:<endpoint_key_name>` (e.g. `epr:roles.create`). The cache is:

- **Warmed on startup** — `onModuleInit` loads all enabled rules into Redis.
- **Updated on mutation** — every create/update/enable/assign operation refreshes the cache for the affected key.
- **Invalidated on disable/delete** — the Redis key is removed when a rule is disabled or deleted.
- **Backfilled on miss** — if a Redis lookup fails but the DB has an enabled rule, the result is written back to Redis.
- **Resilient** — Redis errors are caught and logged; the service falls back to PostgreSQL without disrupting the request.

### EPR Cache Reconciliation

An hourly cron job (`EprCacheReconciliationService`) ensures Redis and PostgreSQL stay in sync:

1. **Delete stale keys** — reads all tracked keys from the `epr_keys` Redis set, deletes the corresponding `epr:*` keys, and clears the tracking set.
2. **Re-warm cache** — calls `warmUpCache()` to reload all enabled rules from PostgreSQL into Redis.

This handles edge cases like Redis restarts, missed invalidations, or manual database changes.

---

## Error Handling

The microservice uses a layered error handling approach with ES2022 cause chaining:

### BaseServiceException

All domain-specific exceptions extend `BaseServiceException` (`src/common/exceptions/base-service.exception.ts`), which adds:

- **Error codes** — each exception carries a machine-readable `errorCode` (e.g. `ROLE_NOT_FOUND`, `PERMISSION_ASSIGN_ERROR`).
- **Cause chaining** — catch blocks pass the original error as `cause`, preserving the full error context.
- **Static helpers** — `getDeepestHttpExceptionMessage()`, `getCauseChain()`, and `getDeepestErrorCode()` for chain traversal.

### AllExceptionsFilter

The global `AllExceptionsFilter` (`src/common/filters/all-exceptions.filter.ts`) catches all unhandled exceptions and:

1. Traverses the cause chain to find the **most specific user-facing message** (from the deepest `HttpException`).
2. Extracts `causeCode` from the deepest `BaseServiceException` if it differs from the top-level `errorCode`.
3. Logs the full cause chain, stack trace, and metadata to Winston.
4. Returns a structured JSON response:

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

The `causeCode` field is only included when it differs from `errorCode`, maintaining backward compatibility.

### serializeError Utility

The `serializeError()` function (`src/common/utils/logger-format.util.ts`) recursively serializes errors into structured objects for Winston logging, including `HttpException` response details and nested `Error.cause` chains.

### Exception Handlers Per Module

Each service module has its own exception class (e.g., `RolesException`, `UsersException`, `PermissionsException`) extending `BaseServiceException` with module-specific error codes. This gives every error a traceable code and consistent structure.

---

## Getting Started

### Prerequisites

- **Node.js 24**
- **PostgreSQL**
- **Redis**
- **RabbitMQ**
- **Docker** (optional — for monitoring stack and integration tests)

### Installation

```bash
npm install
```

### Database Seeding (Required for First Run)

Since all endpoints are protected by the Dynamic Endpoint Permissions system, you **must** run the database seeder before using the application. Without seeding, no endpoint will be accessible.

```bash
npm run seed
```

#### What Gets Seeded

The seeder (`src/database/seed/`) creates the following within a single transaction:

| Entity                        | Count | Description                                                 |
| ----------------------------- | ----- | ----------------------------------------------------------- |
| **Permissions**               | 23    | All permission codes required by endpoint rules             |
| **Endpoint Permission Rules** | 23    | Mappings from `@EndpointKey` values to required permissions |
| **Roles**                     | 1     | `SUPER_ADMIN` role with all permissions                     |
| **Users**                     | 1     | Admin user with `SUPER_ADMIN` role                          |

#### Default Admin Credentials

| Field    | Value             |
| -------- | ----------------- |
| Email    | `admin@admin.com` |
| Password | `admin`           |
| Status   | `ACTIVE`          |
| Role     | `SUPER_ADMIN`     |

**Important**: Change these credentials immediately in production environments.

#### Idempotent Seeding

The seeder uses `upsert` operations with conflict resolution, making it safe to run multiple times:

- Existing permissions are updated (not duplicated)
- Existing roles retain their permission assignments
- The admin user's password is only set on first creation (not re-hashed on re-runs)

#### Seeded Endpoint Rules

All 23 endpoint keys are pre-configured with their required permissions:

| Endpoint Key                         | Required Permission                |
| ------------------------------------ | ---------------------------------- |
| `users.register`                     | `USERS_CREATE`                     |
| `users.update`                       | `USERS_UPDATE`                     |
| `users.find`                         | `USERS_READ`                       |
| `users.find_api`                     | `API_KEY_ACCESS`                   |
| `roles.create`                       | `ROLES_CREATE`                     |
| `roles.update`                       | `ROLES_UPDATE`                     |
| `roles.delete`                       | `ROLES_DELETE`                     |
| `roles.find`                         | `ROLES_READ`                       |
| `permission.create`                  | `PERMISSIONS_CREATE`               |
| `permission.update`                  | `PERMISSIONS_UPDATE`               |
| `permission.delete`                  | `PERMISSIONS_DELETE`               |
| `permission.find`                    | `PERMISSIONS_READ`                 |
| `api-key.generate`                   | `API_KEYS_CREATE`                  |
| `api-key.find`                       | `API_KEYS_READ`                    |
| `api-key.deactivate`                 | `API_KEYS_DEACTIVATE`              |
| `sessions.find`                      | `SESSIONS_READ`                    |
| `sessions.deactivate`                | `SESSIONS_DEACTIVATE`              |
| `endpoint-permission-rules.create`   | `ENDPOINT-PERMISSION-RULES_CREATE` |
| `endpoint-permission-rules.update`   | `ENDPOINT-PERMISSION-RULES_UPDATE` |
| `endpoint-permission-rules.delete`   | `ENDPOINT-PERMISSION-RULES_DELETE` |
| `endpoint-permission-rules.find`     | `ENDPOINT-PERMISSION-RULES_READ`   |
| `endpoint-permission-rules.find_api` | `API_KEY_ACCESS`                   |
| `metrics.get`                        | `METRICS_READ`                     |

### Running the Application

```bash
# Development (watch mode)
npm run start:dev

# Debug mode
npm run start:debug

# Production
npm run build
npm run start:prod
```

The application listens on the port defined by the `PORT` environment variable (defaults to `3000`).

---

## Environment Variables

Copy `example.env` to `.env` and fill in the values:

```bash
cp example.env .env
```

| Variable                    | Required | Default | Description                                                  |
| --------------------------- | -------- | ------- | ------------------------------------------------------------ |
| `DATABASE_HOST`             | Yes      | —       | PostgreSQL connection URI                                    |
| `RABBITMQ_URL`              | Yes      | —       | RabbitMQ connection URI                                      |
| `REDIS_URL`                 | Yes      | —       | Redis connection URI                                         |
| `PORT`                      | Yes      | —       | Application port                                             |
| `APP_NAME`                  | Yes      | —       | Application name                                             |
| `FRONTEND_URL`              | Yes      | —       | Frontend URL (used in email templates)                       |
| `JWT_AUTH_SECRET`           | Yes      | —       | JWT signing secret for access tokens (min 32 chars)          |
| `JWT_REFRESH_SECRET`        | Yes      | —       | JWT signing secret for refresh tokens (min 32 chars)         |
| `JWT_AUTH_EXPIRES_IN`       | Yes      | —       | Access token TTL (e.g. `15m`)                                |
| `JWT_REFRESH_EXPIRES_IN`    | Yes      | —       | Refresh token TTL (e.g. `7d`)                                |
| `RESET_PASSWORD_EXPIRES_IN` | Yes      | —       | Password-reset token TTL (e.g. `30m`)                        |
| `CORS_ORIGIN`               | Yes      | —       | Allowed CORS origins (comma-separated). Required for cookies |
| `COOKIE_DOMAIN`             | No       | —       | Cookie domain (e.g. `.example.com`). Omit for request domain |
| `COOKIE_SECURE`             | No       | `true`  | Set `false` only for local dev without HTTPS                 |
| `METRICS_ENABLED`           | No       | `true`  | Enable Prometheus metrics (`true`/`false`)                   |

---

## API Reference

Swagger UI is available at `/docs` when the application is running.

The OpenAPI spec is exported as `openapi.json` at startup.

### Users

| Method | Path                      | Auth             | Description                       |
| ------ | ------------------------- | ---------------- | --------------------------------- |
| `POST` | `/users/register`         | API Key          | Register a new user               |
| `POST` | `/users/first-activation` | —                | Activate user for the first time  |
| `POST` | `/users/activate/:id`     | Cookie           | Activate a user                   |
| `POST` | `/users/deactivate/:id`   | Cookie           | Deactivate a user                 |
| `POST` | `/users/login`            | —                | Log in (sets cookies)             |
| `POST` | `/users/logout`           | Cookie           | Log out (clears cookies)          |
| `GET`  | `/users/refresh-token`    | Cookie (refresh) | Refresh tokens (sets new cookies) |
| `GET`  | `/users/me`               | API Key + Bearer | Current user info (inter-service) |
| `GET`  | `/users/can-do/:perm`     | API Key + Bearer | Check permission (inter-service)  |
| `POST` | `/users/assign-role/:id`  | Cookie           | Assign roles to a user            |
| `POST` | `/users/forgot-password`  | —                | Request password reset email      |
| `POST` | `/users/reset-password`   | Query token      | Reset password with token         |
| `GET`  | `/users/all`              | Cookie           | List all users                    |

### Roles

| Method   | Path                            | Auth   | Description                  |
| -------- | ------------------------------- | ------ | ---------------------------- |
| `POST`   | `/roles/new`                    | Cookie | Create a new role            |
| `PATCH`  | `/roles/edit/:id`               | Cookie | Update a role                |
| `PATCH`  | `/roles/assign-permissions/:id` | Cookie | Assign permissions to a role |
| `DELETE` | `/roles/delete/:id`             | Cookie | Delete a role                |
| `GET`    | `/roles/find/:id`               | Cookie | Get a role by ID             |
| `GET`    | `/roles/all`                    | Cookie | List all roles               |

### Permissions

| Method   | Path                      | Auth   | Description             |
| -------- | ------------------------- | ------ | ----------------------- |
| `POST`   | `/permissions/new`        | Cookie | Create a new permission |
| `PATCH`  | `/permissions/edit/:id`   | Cookie | Update a permission     |
| `DELETE` | `/permissions/delete/:id` | Cookie | Delete a permission     |
| `GET`    | `/permissions/find/:id`   | Cookie | Get a permission by ID  |
| `GET`    | `/permissions/all`        | Cookie | List all permissions    |

### API Keys

| Method  | Path                       | Auth           | Description              |
| ------- | -------------------------- | -------------- | ------------------------ |
| `GET`   | `/api-keys/can-do/:perm`   | API Key header | Check API key permission |
| `POST`  | `/api-keys/generate`       | Cookie         | Generate a new API key   |
| `GET`   | `/api-keys/all`            | Cookie         | List all API keys        |
| `PATCH` | `/api-keys/deactivate/:id` | Cookie         | Deactivate an API key    |

### Sessions

| Method | Path                        | Auth   | Description                 |
| ------ | --------------------------- | ------ | --------------------------- |
| `GET`  | `/sessions/user/:userId`    | Cookie | Get all sessions for a user |
| `POST` | `/sessions/deactivate/:sid` | Cookie | Deactivate a session        |

### Endpoint Permission Rules

| Method   | Path                                                       | Auth    | Description                      |
| -------- | ---------------------------------------------------------- | ------- | -------------------------------- |
| `POST`   | `/endpoint-permission-rules/new`                           | Cookie  | Create a new rule                |
| `PATCH`  | `/endpoint-permission-rules/edit/:id`                      | Cookie  | Update rule fields               |
| `PATCH`  | `/endpoint-permission-rules/assign-permissions/:id`        | Cookie  | Assign permissions to a rule     |
| `PATCH`  | `/endpoint-permission-rules/enable/:id`                    | Cookie  | Enable a rule                    |
| `PATCH`  | `/endpoint-permission-rules/disable/:id`                   | Cookie  | Disable a rule                   |
| `DELETE` | `/endpoint-permission-rules/delete/:id`                    | Cookie  | Delete a rule                    |
| `GET`    | `/endpoint-permission-rules/all`                           | Cookie  | List all rules                   |
| `GET`    | `/endpoint-permission-rules/find/:id`                      | Cookie  | Get a rule by ID                 |
| `GET`    | `/endpoint-permission-rules/get-endpoint-permissions/:key` | API Key | Get resolved permissions for key |

### Other

| Method | Path       | Auth    | Description        |
| ------ | ---------- | ------- | ------------------ |
| `GET`  | `/metrics` | API Key | Prometheus metrics |
| `GET`  | `/`        | —       | Health check       |

---

## Observability

### Prometheus Metrics

The `/metrics` endpoint exposes the following custom metrics (in addition to default Node.js / process metrics):

| Metric                               | Type      | Description                                                                    |
| ------------------------------------ | --------- | ------------------------------------------------------------------------------ |
| `auth_http_requests_total`           | Counter   | Total HTTP requests (labels: `method`, `route`, `status_code`)                 |
| `auth_http_request_duration_seconds` | Histogram | HTTP request latency                                                           |
| `auth_dependency_duration_seconds`   | Histogram | External dependency call latency (labels: `dependency`, `operation`, `result`) |
| `auth_dependency_errors_total`       | Counter   | Dependency error count                                                         |
| `auth_outbox_batch_size`             | Gauge     | Pending outbox events per cron batch                                           |

### Structured Logging

Winston is configured with JSON format and two file transports:

- `logs/error.log` — error-level messages only.
- `logs/combined.log` — all log levels (info and above).

All log entries include timestamps, structured metadata, and error serialization via `serializeError()`.

### Local Monitoring Stack

A Docker Compose file for Prometheus + Grafana is provided:

```bash
cd ops/monitoring
docker compose -f docker-compose.monitoring.yml up -d
```

| Service    | URL                                   |
| ---------- | ------------------------------------- |
| Prometheus | http://localhost:9090                 |
| Grafana    | http://localhost:3001 (admin / admin) |

---

## Testing

```bash
# Unit tests
npm run test

# Integration tests with pg-mem (in-memory, no Docker needed)
npm run test -- --config test/integration/jest-pg-mem-integration.json

# Integration tests with Testcontainers (requires Docker)
npm run test -- --config test/integration/jest-testcont-integration.json

# E2E tests
npm run test:e2e

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov
```

### Test Infrastructure

- **Unit tests** — colocated with source files (`*.spec.ts`). Use Jest mocks for dependencies.
- **Integration tests (pg-mem)** — in-memory PostgreSQL emulation for fast repository/service tests without Docker.
- **Integration tests (Testcontainers)** — real PostgreSQL in Docker containers for full-fidelity integration tests.
- **E2E tests** — full HTTP request/response testing via Supertest.

---

## Available Scripts

| Script                | Description                                  |
| --------------------- | -------------------------------------------- |
| `npm run start:dev`   | Start in development mode with file watching |
| `npm run start:debug` | Start in debug mode with file watching       |
| `npm run start:prod`  | Start compiled production build              |
| `npm run start`       | Alias for `start:prod`                       |
| `npm run build`       | Compile TypeScript via NestJS CLI            |
| `npm run test`        | Run unit tests with Jest                     |
| `npm run test:watch`  | Run tests in watch mode                      |
| `npm run test:cov`    | Run tests with coverage report               |
| `npm run test:e2e`    | Run end-to-end tests                         |
| `npm run test:debug`  | Run tests with Node.js debugger attached     |
| `npm run format`      | Format code with Prettier                    |
| `npm run lint`        | Lint and auto-fix with ESLint                |
| `npm run seed`        | Run database seeder (required for first run) |

---

## Project Structure

```
src/
├── main.ts                            # Bootstrap, cookie-parser, CORS, Swagger setup
├── app.module.ts                      # Root module (all imports, cron providers)
├── app.controller.ts                  # Health-check controller
├── config/
│   └── env-validation.ts              # Startup env validation (class-validator)
├── entities/                          # TypeORM entities
│   ├── user.entity.ts
│   ├── role.entity.ts
│   ├── permission.entity.ts
│   ├── api-key.entity.ts
│   ├── endpoint-permission-rules.entity.ts
│   └── outbox.entity.ts
├── services/
│   ├── users/                         # User CRUD, auth, password reset
│   ├── roles/                         # Role CRUD + permission assignment
│   ├── permissions/                   # Permission CRUD
│   ├── api-keys/                      # API key management
│   ├── sessions/                      # Session management + real-time permission refresh
│   ├── endpoint-permission-rules/     # Dynamic endpoint permission management
│   └── jwt/                           # Token generation & validation
├── clients/
│   └── email/                         # Email client (RabbitMQ publisher)
├── cron/
│   ├── outbox-publisher.service.ts    # Publishes outbox events to RMQ (every 10s)
│   ├── outbox-subscriber.service.ts   # Consumes RMQ events
│   └── epr-cache-reconciliation.service.ts  # Hourly EPR Redis ↔ DB sync
├── common/
│   ├── guards/
│   │   ├── auth.guard.ts              # Cookie-based JWT auth guard
│   │   ├── api-key.guard.ts           # API key auth guard
│   │   ├── microservice.guard.ts      # Dual auth guard (API key + Bearer)
│   │   └── auth.exception.ts          # Auth error codes and exception class
│   ├── decorators/
│   │   └── endpoint-key.decorator.ts  # @EndpointKey metadata decorator
│   ├── exceptions/
│   │   └── base-service.exception.ts  # Abstract base with cause chaining
│   ├── filters/
│   │   └── all-exceptions.filter.ts   # Global exception filter (Winston logging)
│   ├── context/                       # Request-scoped context (user, metadata)
│   ├── redis/                         # Redis module and service wrapper
│   ├── utils/
│   │   ├── cookie-options.util.ts     # Auth/refresh cookie option factories
│   │   ├── extract-api-key.util.ts    # API key extraction from headers
│   │   ├── find-errors-data.util.ts   # Validation error data extraction
│   │   ├── get-client-ip.util.ts      # Client IP extraction (trust proxy)
│   │   ├── get-ttl.util.ts            # TTL parsing from env vars
│   │   ├── logger-format.util.ts      # serializeError for Winston
│   │   ├── propagate-axios-error.ts   # Axios error propagation
│   │   └── same-subnet-check.util.ts  # IP subnet comparison for sessions
│   └── validators/                    # Custom class-validator constraints
│       ├── unique-email.validator.ts
│       ├── unique-endpoint-key.validator.ts
│       ├── unique-permission-code.validator.ts
│       ├── unique-person.validator.ts
│       └── unique-role-name.validator.ts
├── middlewares/
│   └── request-context.middleware.ts  # Injects IP, user-agent per request
├── observability/
│   ├── observability.module.ts
│   ├── metrics.service.ts             # Prometheus metrics definitions
│   ├── metrics.controller.ts          # /metrics endpoint
│   └── http-metrics.interceptor.ts    # HTTP request metrics interceptor
├── interfaces/
│   ├── DTO/                           # Data Transfer Objects
│   └── *.ts                           # Shared interfaces & types
└── database/
    └── seed/                          # Database seeder (idempotent)
ops/
└── monitoring/
    ├── docker-compose.monitoring.yml
    ├── prometheus/                     # Prometheus config & alert rules
    └── grafana/                        # Grafana provisioning & dashboards
test/
├── integration/
│   ├── pg-mem/                        # In-memory PostgreSQL tests
│   └── testcontainers/                # Docker-based PostgreSQL tests
└── e2e/                               # End-to-end tests
```

---

## License

Private — UNLICENSED

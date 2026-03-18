# Clinfy Auth Microservice

> Authentication, authorization, and user-management microservice built with **NestJS 11**, **TypeScript**, and **PostgreSQL**.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Database Seeding](#database-seeding-required-for-first-run)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Observability](#observability)
- [Testing](#testing)
- [Dynamic Endpoint Permissions](#dynamic-endpoint-permissions)
  - [Security Behavior: Fail-Closed](#security-behavior-fail-closed-by-design)
- [Project Structure](#project-structure)

---

## Overview

This microservice is responsible for managing:

- **Users** — registration, activation/deactivation, login/logout, password reset, and role assignment.
- **Roles** — CRUD and permission grouping.
- **Permissions** — fine-grained access control with unique permission codes.
- **API Keys** — key-based authentication for service-to-service communication.
- **Sessions** — active session tracking per user.
- **JWT** — access & refresh token generation, validation, and rotation.

## Tech Stack

| Layer         | Technology                              |
| ------------- | --------------------------------------- |
| Framework     | NestJS 11                               |
| Language      | TypeScript 5                            |
| Runtime       | Node.js 24                              |
| Database      | PostgreSQL (TypeORM)                    |
| Cache         | Redis                                   |
| Messaging     | RabbitMQ (via `@nestjs/microservices`)  |
| Auth          | JWT (`jsonwebtoken`) + bcrypt           |
| Logging       | Winston (`nest-winston`)                |
| Metrics       | Prometheus (`prom-client`)              |
| Visualization | Grafana                                 |
| API Docs      | Swagger (`@nestjs/swagger`)             |
| Validation    | `class-validator` + `class-transformer` |
| Scheduling    | `@nestjs/schedule`                      |

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                   NestJS - Auth-Microservice                       │
│                                                                    │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────┐           │
│  │  Users   │  │  Roles   │  │Permissions│  │ API Keys │           │
│  │Controller│  │Controller│  │Controller │  │Controller│           │
│  └────┬─────┘  └─────┬────┘  └─────┬─────┘  └──────┬───┘           │
│       │              │             │               │               │
│  ┌────▼─────┐  ┌────▼─────┐  ┌─────▼──────┐  ┌─────▼────┐          │
│  │  Users   │  │  Roles   │  │Permissions │  │ API Keys │          │
│  │ Service  │  │ Service  │  │  Service   │  │ Service  │          │
│  └────┬─────┘  └─────┬────┘  └─────┬──────┘  └─────┬────┘          │
│       │              │             │               │               │
│  ┌────▼──────────────▼─────────────▼───────────────▼──────┐        │
│  │                     TypeORM (PostgreSQL)               │        │
│  └────────────────────────────────────────────────────────┘        │
│                                                                    │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐           │
│  │   Sessions   │  │ JWT Service │  │  Email Client    │           │
│  │   Service    │  │             │  │  (RabbitMQ)      │           │
│  └──────┬───────┘  └─────────────┘  └──────────────────┘           │
│         │                                                          │
│    ┌────▼────┐         ┌──────────────────────────────┐            │
│    │  Redis  │         │ Outbox Pattern (Cron → RMQ)  │            │
│    └─────────┘         └──────────────────────────────┘            │
│                                                                    │
│  ┌───────────────────────────────────────┐                         │
│  │  Observability (Prometheus + Grafana) │                         │
│  └───────────────────────────────────────┘                         │
└────────────────────────────────────────────────────────────────────┘
```

### Key Patterns

- **Outbox pattern** — audit events are persisted to an `outbox` table and published to RabbitMQ every 10 s by a cron job, ensuring at-least-once delivery.
- **Request Context** — a middleware injects per-request metadata (IP, user-agent) available throughout the request lifecycle.
- **Custom Exception Handlers** — each service module has its own exception handler for consistent, domain-specific error responses.
- **Global Exception Filter** — a centralized `AllExceptionsFilter` catches unhandled errors and logs them via Winston.
- **Environment Validation** — startup fails fast if required environment variables are missing or malformed (`class-validator` schema in `src/config/env-validation.ts`).

## Dynamic Endpoint Permissions

### Overview

The **Dynamic Endpoint Permissions** system allows changing which permissions an endpoint requires **at runtime**, without code changes or redeployment. Each controller method is tagged with an `@EndpointKey('unique.key')` decorator, and permission rules for those keys are managed via the API, stored in PostgreSQL, and cached in Redis.

### How It Works — Three-Tier Permission Resolution

The `AuthGuard` resolves required permissions using a three-tier chain:

```
Request → AuthGuard
           │
           ├─ 1. @EndpointKey found?
           │     ├─ YES → look up dynamic rule in Redis (fallback: DB)
           │     │         ├─ Rule found & enabled → enforce those permissions
           │     │         └─ No rule / disabled   → fall through ↓
           │     └─ NO  → fall through ↓
           │
           ├─ 2. (No dynamic rule matched)
           │     └─ Access denyed — until rule creation on DB
           │
           └─ Result: allow or 403 Forbidden
```

1. **Dynamic rule lookup** — If the endpoint has `@EndpointKey`, the guard queries `EndpointPermissionRulesService` for that key. If an enabled rule exists, its permission list is enforced against the user's session permissions.
2. **No matching rule** — If no `@EndpointKey` is present access is denyed until rule creation on DB. This is to avoid any situation where unintentionally leaving an endpoint unprotected. The idea is that every guarded endpoint should have a corresponding rule in the DB, even if it's just a placeholder with no permissions.

### The `@EndpointKey` Decorator

A thin metadata decorator built with NestJS `Reflector`:

```ts
// src/middlewares/decorators/endpoint-key.decorator.ts
import { Reflector } from '@nestjs/core';

export const EndpointKey = Reflector.createDecorator<string>();
```

#### Security Behavior: Fail-Closed by Design

The `@EndpointKey` system implements a **fail-closed** security model. This is an intentional design decision to prevent accidentally exposing sensitive endpoints:

| Scenario                                        | Behavior                                                                                                    |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `@EndpointKey` present + rule exists + enabled  | Permission check enforced                                                                                   |
| `@EndpointKey` present + rule exists + disabled | Access denied (fall-through, returns `null`)                                                                |
| `@EndpointKey` present + **no rule in DB**      | **Access denied** (HTTP 404: "endpoint does not have a permission rule defined and is temporally disabled") |
| No `@EndpointKey` decorator                     | Access allowed (endpoint not protected by dynamic rules)                                                    |

**Why this matters**: When a developer adds `@EndpointKey('some.key')` to an endpoint but forgets to create the corresponding rule in the database, the endpoint becomes **inaccessible** rather than unprotected. This prevents security gaps caused by missing configuration.

**Implementation**: See `src/services/endpoint-permission-rules/endpoint-permission-rules.service.ts:73-110` — the `getPermissionsForEndpoint()` method throws an exception when no rule is found for a registered endpoint key.

#### Usage

Place `@EndpointKey` on any guarded controller method, right after `@UseGuards`:

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
| `sessions.find`                      | `GET /sessions/all`                                                                                |
| `sessions.deactivate`                | `PATCH /sessions/deactivate/:id`                                                                   |
| `endpoint-permission-rules.create`   | `POST /endpoint-permission-rules/new`                                                              |
| `endpoint-permission-rules.update`   | `PATCH /endpoint-permission-rules/edit/:id`, `enable/:id`, `disable/:id`, `assign-permissions/:id` |
| `endpoint-permission-rules.delete`   | `DELETE /endpoint-permission-rules/delete/:id`                                                     |
| `endpoint-permission-rules.find`     | `GET /endpoint-permission-rules/all`, `find/:id`                                                   |
| `endpoint-permission-rules.find_api` | `get-endpoint-permissions/:key`                                                                    |
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

## Getting Started

### Prerequisites

- **Node.js 24**
- **PostgreSQL**
- **Redis**
- **RabbitMQ**

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

## Environment Variables

Copy `example.env` to `.env` and fill in the values:

```bash
cp example.env .env
```

| Variable                    | Required | Description                                                |
| --------------------------- | -------- | ---------------------------------------------------------- |
| `DATABASE_HOST`             | ✅       | PostgreSQL connection URI                                  |
| `RABBITMQ_URL`              | ✅       | RabbitMQ connection URI                                    |
| `REDIS_URL`                 | ✅       | Redis connection URI                                       |
| `PORT`                      | ✅       | Application port                                           |
| `APP_NAME`                  | ✅       | Application name                                           |
| `FRONTEND_URL`              | ✅       | Frontend URL (used in email templates)                     |
| `JWT_AUTH_SECRET`           | ✅       | JWT signing secret for access tokens (min 32 chars)        |
| `JWT_REFRESH_SECRET`        | ✅       | JWT signing secret for refresh tokens (min 32 chars)       |
| `JWT_AUTH_EXPIRES_IN`       | ✅       | Access token TTL (e.g. `15m`)                              |
| `JWT_REFRESH_EXPIRES_IN`    | ✅       | Refresh token TTL (e.g. `7d`)                              |
| `RESET_PASSWORD_EXPIRES_IN` | ✅       | Password-reset token TTL (e.g. `30m`)                      |
| `METRICS_ENABLED`           | ❌       | Enable Prometheus metrics (`true`/`false`, default `true`) |

## API Documentation

Swagger UI is available at `/docs` when the application is running.

The OpenAPI spec is also exported as `openapi.json` at startup.

### Main Endpoints

| Method | Path                           | Auth    | Description                              |
| ------ | ------------------------------ | ------- | ---------------------------------------- |
| `POST` | `/users/register`              | API Key | Register a new user                      |
| `POST` | `/users/first-activation`      | —       | Activate user for the first time         |
| `POST` | `/users/activate/:id`          | Bearer  | Activate a user                          |
| `POST` | `/users/deactivate/:id`        | Bearer  | Deactivate a user                        |
| `POST` | `/users/login`                 | —       | Log in                                   |
| `POST` | `/users/logout`                | Bearer  | Log out                                  |
| `GET`  | `/users/refresh-token`         | Header  | Refresh tokens                           |
| `GET`  | `/users/me`                    | Bearer  | Current user info                        |
| `GET`  | `/users/can-do/:permission`    | Bearer  | Check permission                         |
| `POST` | `/users/assign-role/:id`       | Bearer  | Assign roles to a user                   |
| `POST` | `/users/forgot-password`       | —       | Request password reset email             |
| `POST` | `/users/reset-password`        | Query   | Reset password with token                |
| `GET`  | `/users/all`                   | Bearer  | List all users                           |
| `CRUD` | `/permissions/*`               | Bearer  | Manage permissions                       |
| `CRUD` | `/roles/*`                     | Bearer  | Manage roles                             |
| `CRUD` | `/api-keys/*`                  | Bearer  | Manage API keys                          |
| `CRUD` | `/endpoint-permission-rules/*` | Bearer  | Manage dynamic endpoint permission rules |
| `GET`  | `/sessions/*`                  | Bearer  | View active sessions                     |
| `GET`  | `/metrics`                     | API Key | Prometheus metrics                       |

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

## Testing

```bash
# Unit tests
npm run test

# Integration tests (uses Testcontainers — requires Docker)
npm run test -- --testPathPattern=test/integration

# E2E tests
npm run test:e2e

# Coverage report
npm run test:cov
```

## Project Structure

```
src/
├── main.ts                        # Bootstrap & Swagger setup
├── app.module.ts                  # Root module
├── app.controller.ts              # Health-check controller
├── config/
│   └── env-validation.ts          # Startup env validation
├── entities/                      # TypeORM entities
│   ├── user.entity.ts
│   ├── role.entity.ts
│   ├── permission.entity.ts
│   ├── api-key.entity.ts
│   ├── endpoint-permission-rules.entity.ts
│   └── outbox.entity.ts
├── services/
│   ├── users/                     # User CRUD, auth, password reset
│   ├── roles/                     # Role CRUD
│   ├── permissions/               # Permission CRUD
│   ├── api-keys/                  # API key management
│   ├── sessions/                  # Session management
│   ├── endpoint-permission-rules/ # Dynamic endpoint permission management
│   └── JWT/                       # Token generation & validation
├── clients/
│   └── email/                     # Email client (RabbitMQ)
├── cron/
│   ├── outbox-publisher.service.ts  # Publishes outbox events to RMQ
│   └── outbox-subscriber.service.ts # Consumes RMQ events
├── middlewares/
│   ├── auth.middleware.ts         # JWT bearer auth guard
│   ├── api-key.middleware.ts      # API key auth guard
│   ├── auth.exception.handler.ts  # Auth error handling
│   ├── request-context.middleware.ts
│   └── decorators/
│       └── endpoint-key.decorator.ts
├── observability/
│   ├── observability.module.ts
│   ├── metrics.service.ts         # Prometheus metrics definitions
│   ├── metrics.controller.ts      # /metrics endpoint
│   └── http-metrics.interceptor.ts
├── common/
│   ├── context/                   # Request-scoped context
│   ├── filters/                   # Global exception filter
│   ├── redis/                     # Redis module
│   ├── tools/                     # Utility functions
│   └── validators/                # Custom class-validator constraints
├── interfaces/
│   ├── DTO/                       # Data Transfer Objects
│   └── *.ts                       # Shared interfaces & types
ops/
└── monitoring/
    ├── docker-compose.monitoring.yml
    ├── prometheus/                 # Prometheus config & alert rules
    └── grafana/                    # Grafana provisioning & dashboards
test/
├── integration/                   # Integration tests (Testcontainers)
└── e2e/                           # End-to-end tests
```

## License

Private — UNLICENSED

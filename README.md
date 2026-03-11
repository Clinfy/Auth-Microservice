# Clinfy Auth Microservice

> Authentication, authorization, and user-management microservice built with **NestJS 11**, **TypeScript**, and **PostgreSQL**.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Observability](#observability)
- [Testing](#testing)
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

| Layer | Technology |
|---|---|
| Framework | NestJS 11 |
| Language | TypeScript 5 |
| Runtime | Node.js 24 |
| Database | PostgreSQL (TypeORM) |
| Cache | Redis |
| Messaging | RabbitMQ (via `@nestjs/microservices`) |
| Auth | JWT (`jsonwebtoken`) + bcrypt |
| Logging | Winston (`nest-winston`) |
| Metrics | Prometheus (`prom-client`) |
| Visualization | Grafana |
| API Docs | Swagger (`@nestjs/swagger`) |
| Validation | `class-validator` + `class-transformer` |
| Scheduling | `@nestjs/schedule` |

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        NestJS Application                         │
│                                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │  Users   │  │  Roles   │  │Permissions│  │ API Keys │          │
│  │Controller│  │Controller│  │Controller │  │Controller│          │
│  └────┬─────┘  └────┬─────┘  └────┬──────┘  └────┬─────┘         │
│       │              │             │               │               │
│  ┌────▼─────┐  ┌────▼─────┐  ┌────▼──────┐  ┌────▼─────┐        │
│  │  Users   │  │  Roles   │  │Permissions │  │ API Keys │        │
│  │ Service  │  │ Service  │  │  Service   │  │ Service  │        │
│  └────┬─────┘  └────┬─────┘  └────┬──────┘  └────┬─────┘        │
│       │              │             │               │               │
│  ┌────▼──────────────▼─────────────▼───────────────▼──────┐       │
│  │                     TypeORM (PostgreSQL)                │       │
│  └────────────────────────────────────────────────────────┘       │
│                                                                    │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐         │
│  │   Sessions   │  │  JWT Service │  │  Email Client    │         │
│  │   Service    │  │             │   │  (RabbitMQ)      │         │
│  └──────┬───────┘  └─────────────┘  └──────────────────┘         │
│         │                                                          │
│    ┌────▼────┐         ┌──────────────────────────────┐           │
│    │  Redis  │         │ Outbox Pattern (Cron → RMQ)  │           │
│    └─────────┘         └──────────────────────────────┘           │
│                                                                    │
│  ┌──────────────────────────────────────┐                         │
│  │  Observability (Prometheus + Grafana) │                        │
│  └──────────────────────────────────────┘                         │
└────────────────────────────────────────────────────────────────────┘
```

### Key Patterns

- **Outbox pattern** — audit events are persisted to an `outbox` table and published to RabbitMQ every 10 s by a cron job, ensuring at-least-once delivery.
- **Request Context** — a middleware injects per-request metadata (IP, user-agent) available throughout the request lifecycle.
- **Custom Exception Handlers** — each service module has its own exception handler for consistent, domain-specific error responses.
- **Global Exception Filter** — a centralized `AllExceptionsFilter` catches unhandled errors and logs them via Winston.
- **Environment Validation** — startup fails fast if required environment variables are missing or malformed (`class-validator` schema in `src/config/env-validation.ts`).

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

| Variable | Required | Description |
|---|---|---|
| `DATABASE_HOST` | ✅ | PostgreSQL connection URI |
| `RABBITMQ_URL` | ✅ | RabbitMQ connection URI |
| `REDIS_URL` | ✅ | Redis connection URI |
| `PORT` | ✅ | Application port |
| `APP_NAME` | ✅ | Application name |
| `FRONTEND_URL` | ✅ | Frontend URL (used in email templates) |
| `JWT_AUTH_SECRET` | ✅ | JWT signing secret for access tokens (min 32 chars) |
| `JWT_REFRESH_SECRET` | ✅ | JWT signing secret for refresh tokens (min 32 chars) |
| `JWT_AUTH_EXPIRES_IN` | ✅ | Access token TTL (e.g. `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | ✅ | Refresh token TTL (e.g. `7d`) |
| `RESET_PASSWORD_EXPIRES_IN` | ✅ | Password-reset token TTL (e.g. `30m`) |
| `METRICS_ENABLED` | ❌ | Enable Prometheus metrics (`true`/`false`, default `true`) |

## API Documentation

Swagger UI is available at `/docs` when the application is running.

The OpenAPI spec is also exported as `openapi.json` at startup.

### Main Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/users/register` | API Key | Register a new user |
| `POST` | `/users/first-activation` | — | Activate user for the first time |
| `POST` | `/users/activate/:id` | Bearer | Activate a user |
| `POST` | `/users/deactivate/:id` | Bearer | Deactivate a user |
| `POST` | `/users/login` | — | Log in |
| `POST` | `/users/logout` | Bearer | Log out |
| `GET`  | `/users/refresh-token` | Header | Refresh tokens |
| `GET`  | `/users/me` | Bearer | Current user info |
| `GET`  | `/users/can-do/:permission` | Bearer | Check permission |
| `POST` | `/users/assign-role/:id` | Bearer | Assign roles to a user |
| `POST` | `/users/forgot-password` | — | Request password reset email |
| `POST` | `/users/reset-password` | Query | Reset password with token |
| `GET`  | `/users/all` | Bearer | List all users |
| `CRUD` | `/permissions/*` | Bearer | Manage permissions |
| `CRUD` | `/roles/*` | Bearer | Manage roles |
| `CRUD` | `/api-keys/*` | Bearer | Manage API keys |
| `GET`  | `/sessions/*` | Bearer | View active sessions |
| `GET`  | `/metrics` | API Key | Prometheus metrics |

## Observability

### Prometheus Metrics

The `/metrics` endpoint exposes the following custom metrics (in addition to default Node.js / process metrics):

| Metric | Type | Description |
|---|---|---|
| `auth_http_requests_total` | Counter | Total HTTP requests (labels: `method`, `route`, `status_code`) |
| `auth_http_request_duration_seconds` | Histogram | HTTP request latency |
| `auth_dependency_duration_seconds` | Histogram | External dependency call latency (labels: `dependency`, `operation`, `result`) |
| `auth_dependency_errors_total` | Counter | Dependency error count |
| `auth_outbox_batch_size` | Gauge | Pending outbox events per cron batch |

### Local Monitoring Stack

A Docker Compose file for Prometheus + Grafana is provided:

```bash
cd ops/monitoring
docker compose -f docker-compose.monitoring.yml up -d
```

| Service | URL |
|---|---|
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 (admin / admin) |

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
│   └── outbox.entity.ts
├── services/
│   ├── users/                     # User CRUD, auth, password reset
│   ├── roles/                     # Role CRUD
│   ├── permissions/               # Permission CRUD
│   ├── api-keys/                  # API key management
│   ├── sessions/                  # Session management
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
│       └── permissions.decorator.ts
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

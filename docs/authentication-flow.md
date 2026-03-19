# Authentication Flow

Detailed documentation of the authentication mechanisms in the Auth-Microservice.

## Table of Contents

- [Overview](#overview)
- [Cookie-Based JWT (Browser Clients)](#cookie-based-jwt-browser-clients)
  - [Login Flow](#login-flow)
  - [Authenticated Request Flow](#authenticated-request-flow)
  - [Token Refresh Flow](#token-refresh-flow)
  - [Logout Flow](#logout-flow)
  - [Password Reset Flow](#password-reset-flow)
- [Inter-Service Authentication (MicroserviceGuard)](#inter-service-authentication-microserviceguard)
- [API Key Authentication](#api-key-authentication)
- [Session Management in Redis](#session-management-in-redis)
- [Guards Reference](#guards-reference)
- [Security Design Decisions](#security-design-decisions)

---

## Overview

The microservice implements three authentication mechanisms:

| Mechanism       | Transport               | Guard               | Used By                  |
| --------------- | ----------------------- | ------------------- | ------------------------ |
| Cookie JWT      | HTTP-only cookies       | `AuthGuard`         | Browser/frontend clients |
| Dual auth (M2M) | API key + Bearer header | `MicroserviceGuard` | Other microservices      |
| API key only    | `x-api-key` header      | `ApiKeyGuard`       | Service-only endpoints   |

Tokens are **never** returned in response bodies. The frontend has zero JavaScript access to raw tokens.

---

## Cookie-Based JWT (Browser Clients)

### Login Flow

**Endpoint:** `POST /users/login`  
**Auth:** None (public)

![Login Flow](diagrams/login-flow.puml)

**Key points:**

- The controller sets both cookies via `response.cookie()` and returns only a message.
- `auth_token` cookie: `path=/`, sent with all requests.
- `refresh_token` cookie: `path=/users/refresh-token`, sent only to the refresh endpoint.
- Session is stored in Redis as JSON with key `auth_session:{sid}`.

### Authenticated Request Flow

**Guard:** `AuthGuard` (reads `auth_token` cookie)

![Authenticated Request Flow](diagrams/authenticated-request-flow.puml)

**Validation steps in AuthGuard:**

1. Extract `auth_token` from cookies.
2. Decode and verify JWT via `JwtService.getPayload()`.
3. Load session from Redis by `sid`.
4. Verify session is active, email matches JWT payload, and IP is in the same subnet.
5. Resolve `@EndpointKey` decorator → look up dynamic permissions in Redis (fallback: DB).
6. Check user's session permissions against required permissions.

### Token Refresh Flow

**Endpoint:** `GET /users/refresh-token`  
**Auth:** Refresh token cookie (automatically sent because `path` matches)

![Token Refresh Flow](diagrams/token-refresh-flow.puml)

**Key points:**

- The `refresh_token` cookie has `path: /users/refresh-token`, so it is only sent to this specific endpoint.
- Refresh token rotation is conditional (handled by `JwtService`).
- New cookies replace the old ones automatically (same name + path = overwrite).

### Logout Flow

**Endpoint:** `POST /users/logout`  
**Auth:** Cookie (`auth_token`)

![Logout Flow](diagrams/logout-flow.puml)

**Steps:**

1. `AuthGuard` validates the cookie and loads the session.
2. `UsersService.logOut()` invalidates the session in Redis.
3. Controller clears both cookies: `response.clearCookie('auth_token', { path: '/' })` and `response.clearCookie('refresh_token', { path: '/users/refresh-token' })`.

### Password Reset Flow

![Password Reset Flow](diagrams/password-reset-flow.puml)

1. `POST /users/forgot-password` — sends a password reset email via RabbitMQ with a time-limited token.
2. `POST /users/reset-password?token=<token>` — validates the token and updates the password.

No cookies are involved in this flow — the token is passed as a query parameter.

---

## Inter-Service Authentication (MicroserviceGuard)

**Guard:** `MicroserviceGuard` (`src/common/guards/microservice.guard.ts`)

Used for endpoints that other microservices consume on behalf of a user:

| Endpoint                        | Purpose                                 |
| ------------------------------- | --------------------------------------- |
| `GET /users/me`                 | Get authenticated user info             |
| `GET /users/can-do/:permission` | Check if user has a specific permission |

### Full Flow

![Inter-Service Authentication Flow](diagrams/inter-service-auth-flow.puml)

### Dual Authentication Steps

1. **API key validation**: Extract `x-api-key` header → find active key via `ApiKeysService.findActiveByPlainKey()` (bcrypt comparison) → check `@EndpointKey` dynamic permissions against the API key's permission codes.
2. **Bearer token validation**: Extract `Authorization: Bearer <token>` header → decode JWT → load Redis session → verify session is active and email matches payload. **No IP/subnet check** is performed because the request originates from a microservice, not the user's browser.

### Why Dual Auth?

- **Defense in depth**: Compromising either the API key or the user token alone is insufficient.
- **Auditability**: Logs show which microservice made the call (API key) and for which user (Bearer token).
- **Granular control**: Each microservice's API key can be revoked independently.
- **Prevents abuse**: Users cannot call these endpoints directly from browser tools without an API key.

---

## API Key Authentication

**Guard:** `ApiKeyGuard` (`src/common/guards/api-key.guard.ts`)

Used for service-only endpoints where no user context is needed:

| Endpoint                                                       | Purpose                                        |
| -------------------------------------------------------------- | ---------------------------------------------- |
| `POST /users/register`                                         | User registration (called by frontend service) |
| `GET /endpoint-permission-rules/get-endpoint-permissions/:key` | EPR lookup (called by other services)          |
| `GET /metrics`                                                 | Prometheus metrics scraping                    |

The API key is sent in the `x-api-key` header and validated via bcrypt comparison against stored hashes.

---

## Session Management in Redis

Each login creates a session stored in Redis:

- **Key format**: `auth_session:{session_id}`
- **Tracking set**: `user_sessions:{user_id}` — set of all active session IDs for a user.
- **TTL**: Matches the access token expiry (`JWT_AUTH_EXPIRES_IN`).

### Session Data Structure

```typescript
interface Session {
  user_id: string;
  email: string;
  person_id: string;
  ip: string;
  user_agent: string;
  permissions: string[]; // Flat array of permission codes
  active: boolean;
  created_at: string;
}
```

### Real-Time Permission Refresh

When roles or permissions change, active sessions are updated immediately:

| Trigger                            | Method Called                                                    |
| ---------------------------------- | ---------------------------------------------------------------- |
| `UsersService.assignRole()`        | `SessionsService.refreshSessionPermissions(userId, permissions)` |
| `RolesService.assignPermissions()` | `SessionsService.refreshSessionPermissionsByRole(roleId)`        |

The per-role method finds all users with that role, resolves their current `permissionCodes`, and updates each user's sessions. Uses `KEEPTTL` to preserve session expiry.

![Real-Time Permission Refresh](diagrams/realtime-permission-refresh.puml)

---

## Guards Reference

| Guard               | Location                                  | Auth Mechanism          | IP Check | Use Case                 |
| ------------------- | ----------------------------------------- | ----------------------- | -------- | ------------------------ |
| `AuthGuard`         | `src/common/guards/auth.guard.ts`         | Cookie (`auth_token`)   | Yes      | Browser-facing endpoints |
| `MicroserviceGuard` | `src/common/guards/microservice.guard.ts` | API key + Bearer header | No       | Inter-service endpoints  |
| `ApiKeyGuard`       | `src/common/guards/api-key.guard.ts`      | `x-api-key` header      | No       | Service-only endpoints   |

All guards integrate with the Dynamic Endpoint Permissions system via the `@EndpointKey` decorator to enforce runtime-configurable permissions.

---

## Security Design Decisions

### Why Cookies Instead of Bearer Tokens?

- **XSS protection**: `httpOnly` cookies are inaccessible to JavaScript. No risk of token theft via XSS.
- **No client-side storage**: Tokens never touch `localStorage` or `sessionStorage`.
- **Automatic transmission**: Cookies are sent automatically by the browser — the frontend requires zero token management logic.
- **Clear separation**: Cookies = human users via browser. Bearer + API key = microservices.

### Why `sameSite: strict`?

- Eliminates all CSRF attack vectors without requiring a CSRF token.
- Cookies are never sent on cross-origin requests (GET, POST, fetch, forms, iframes).
- Acceptable tradeoff: the frontend is accessed directly, not via external navigation.

### Why Restrict `refresh_token` Path?

The `refresh_token` cookie has `path: /users/refresh-token`, which means the browser only sends it to that specific endpoint. This minimizes the refresh token's exposure surface — it is never transmitted to any other endpoint.

### Why No IP Check in MicroserviceGuard?

Inter-service requests originate from the microservice's own IP, not the user's browser. IP validation would always fail because the calling service's IP would never match the IP stored in the user's session. The API key validation provides the service-level trust instead.

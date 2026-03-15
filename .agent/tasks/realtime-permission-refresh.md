# Real-time Permission Refresh in Redis Sessions

## Problem

When an admin changes a user's roles (`assignRole`) or a role's permissions (`assignPermissions`), active sessions in Redis retain stale `permissions` arrays. The `canDo()` guard reads permissions directly from the session JSON, so users keep old permissions until they refresh their token.

## Solution

Add two methods to `SessionsService`:

1. `refreshSessionPermissions(userId, permissions)` — updates the `permissions` field (typed as `Session`) across all active sessions for a single user.
2. `refreshSessionPermissionsByRole(roleId)` — finds all users with the given role, resolves their current `permissionCodes`, and delegates to the per-user method for each.

Call the per-user method from `UsersService.assignRole()` and the per-role method from `RolesService.assignPermissions()`.

## Scope

- **No new modules, no RabbitMQ, no cron jobs** — direct service calls within the same microservice.
- Two trigger points, two `SessionsService` methods (one delegates to the other).
- All session JSON parsing/writing uses the `Session` interface for type safety.

---

## Implementation Plan

### Step 1a: Add `refreshSessionPermissions()` to `SessionsService`

**File:** `src/services/sessions/sessions.service.ts`

Add a new method:

```typescript
async refreshSessionPermissions(userId: string, permissions: string[]): Promise<void>
```

**Logic:**

1. Get all session IDs from Redis set `user_sessions:{userId}` via `sMembers`.
2. If set is empty, return early (user has no active sessions).
3. Bulk-fetch session JSONs via `mGet` on keys `auth_session:{sid}`.
4. For each valid session: parse JSON **as `Session`**, replace `permissions` with the new array, write back with `set(..., { KEEPTTL: true })`.
5. Clean up stale entries (sessions in the set that no longer exist in Redis) via `sRem` — same pattern as `findUserSessions()`.

**Type safety:** The parsed JSON must be typed as `Session` (from `src/interfaces/session.interface.ts`). The updated object is spread/reconstructed as `Session` before `JSON.stringify`.

**Why in SessionsService:** This follows the existing pattern — `SessionsService` already owns Redis session reads (`findUserSessions`) and mutations (`deactivateSession`). It keeps Redis logic centralized.

### Step 1b: Add `refreshSessionPermissionsByRole()` to `SessionsService`

**File:** `src/services/sessions/sessions.service.ts`

Add a second method:

```typescript
async refreshSessionPermissionsByRole(roleId: string): Promise<void>
```

**Logic:**

1. Query all users that have the given role using `UserRepository` (e.g., `userRepository.find({ where: { roles: { id: roleId } } })`). The User entity eager-loads `roles` and `roles.permissions`, so `user.permissionCodes` will be available.
2. For each user, call `this.refreshSessionPermissions(user.id, user.permissionCodes)`.

**Why in SessionsService (not RolesService):** This keeps the "find affected users → update their sessions" logic encapsulated. `RolesService` only needs to call one method with the `roleId` — it doesn't need to know about Redis, users, or session structure. Clean separation of responsibilities.

**Dependency:** `SessionsService` needs `UserRepository` injected (read-only access — only used to query users by role). Update `SessionsModule` to import `TypeOrmModule.forFeature([UserEntity])`. This avoids a circular dependency between `SessionsModule` and `UsersModule` — `SessionsService` accesses the repository directly instead of going through `UsersService`.

### Step 2: Call from `UsersService.assignRole()`

**File:** `src/services/users/users.service.ts`

After `this.userRepository.save(user)`, add:

```typescript
await this.sessionService.refreshSessionPermissions(user.id, user.permissionCodes);
```

**Dependency:** `SessionsService` must be injected into `UsersService`. Check if it already is; if not, add the injection and update `UsersModule` imports.

### Step 3: Call from `RolesService.assignPermissions()`

**File:** `src/services/roles/roles.service.ts`

This is the more complex case: changing a role's permissions affects **all users with that role**. However, `RolesService` does NOT need to handle that complexity — it delegates entirely.

After `this.roleRepository.save(role)`, add:

```typescript
await this.sessionService.refreshSessionPermissionsByRole(roleId);
```

**Dependency:** `SessionsService` must be injected into `RolesService`. Update `RolesModule` imports as needed.

`RolesService` knows nothing about users, Redis, or sessions — it just tells `SessionsService` "this role changed, handle it".

### Step 4: Update module imports

- **`SessionsModule`** must export `SessionsService` and import `TypeOrmModule.forFeature([UserEntity])` (read-only access for querying users by role — avoids circular dependency with `UsersModule`).
- **`UsersModule`** must import `SessionsModule`.
- **`RolesModule`** must import `SessionsModule`.

**Dependency graph after changes:**

```
UsersModule   → RolesModule  → PermissionsModule
UsersModule   → SessionsModule
RolesModule   → SessionsModule
SessionsModule → TypeOrmModule (UserEntity, read-only)
```

No circular dependencies. `SessionsModule` accesses `UserRepository` directly for the simple "find users by role" query, avoiding any need for `forwardRef()`.

### Step 5: Unit tests

- **`sessions.service.spec.ts`**: Test both new methods:
  - `refreshSessionPermissions()` — mock Redis `sMembers`, `mGet`, `set`, `sRem`. Verify it updates permissions correctly using `Session` type and cleans stale entries.
  - `refreshSessionPermissionsByRole()` — mock `UserRepository.find()` to return users with known `permissionCodes`, verify it calls `refreshSessionPermissions()` for each user.
- **`users.service.spec.ts`**: Verify `assignRole()` calls `sessionService.refreshSessionPermissions()` after saving.
- **`roles.service.spec.ts`**: Verify `assignPermissions()` calls `sessionService.refreshSessionPermissionsByRole()` with the correct `roleId`.

---

## Key Decisions

1. **No cron/polling** — synchronous update in the same request flow. Keeps it simple and real-time.
2. **KEEPTTL** — session TTL is preserved, consistent with existing `deactivateSession()` and `refreshToken()` patterns.
3. **Centralized in SessionsService** — all Redis session mutations stay in one place.
4. **Two methods, clear separation** — `refreshSessionPermissions(userId, permissions)` handles the Redis work for one user; `refreshSessionPermissionsByRole(roleId)` handles the "find affected users" logic and delegates. Callers (`UsersService`, `RolesService`) have minimal coupling.
5. **Typed with `Session` interface** — all JSON parsing/reconstruction uses the `Session` interface from `src/interfaces/session.interface.ts`.
6. **Direct `UserRepository` access (read-only)** — `SessionsService` queries `UserRepository` directly to find users by role, instead of depending on `UsersService`. This avoids a circular dependency (`SessionsModule ↔ UsersModule`) and is justified because it's a simple read query, not business logic.
7. **Bulk mGet + individual set** — follows the existing pattern in `findUserSessions()` for reads and `deactivateSession()` for writes.

## Files to Modify

| File                                             | Change                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------- |
| `src/services/sessions/sessions.service.ts`      | Add `refreshSessionPermissions()` + `refreshSessionPermissionsByRole()`   |
| `src/services/sessions/sessions.module.ts`       | Export `SessionsService`, import `TypeOrmModule.forFeature([UserEntity])` |
| `src/services/users/users.service.ts`            | Call `refreshSessionPermissions()` after `assignRole()`                   |
| `src/services/users/users.module.ts`             | Import `SessionsModule` if needed                                         |
| `src/services/roles/roles.service.ts`            | Call `refreshSessionPermissionsByRole()` after `assignPermissions()`      |
| `src/services/roles/roles.module.ts`             | Import `SessionsModule`                                                   |
| `src/services/sessions/sessions.service.spec.ts` | Tests for both new methods                                                |
| `src/services/users/users.service.spec.ts`       | Tests for assignRole integration                                          |
| `src/services/roles/roles.service.spec.ts`       | Tests for assignPermissions integration                                   |

## Verification

- `npm run test` — all existing + new tests pass
- `npm run build` — no compilation errors

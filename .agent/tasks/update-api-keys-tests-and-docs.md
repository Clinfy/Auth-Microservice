# Update API Keys Tests and Documentation

## Context

The API key system was migrated from bcrypt hashing to HMAC-SHA256 with Redis caching. The user made manual modifications to the implementation files after the initial agent-driven implementation. The tests were rolled back to the pre-migration state and need to be updated to match the current implementation.

---

## 1. Manual Changes Made by User (vs Expected State from Engram #89)

### 1.1 Service Constructor Signature

**Current** (`api-keys.service.ts`): 6-argument constructor:

```
(ApiKeysRepository, DataSource, PermissionsService, ConfigService, RedisService, Logger)
```

**Old tests expect**: 3-argument constructor:

```
(ApiKeysRepository, DataSource, PermissionsService)
```

### 1.2 Entity Field Rename

**Current** (`api-key.entity.ts`): Field is `key_fingerprint` (HMAC-SHA256 digest).
**Old tests reference**: `key_hash` (bcrypt hash) — 4 references across unit and integration tests.

### 1.3 `create()` Method Changes

**Current implementation**:

- Uses `this.generatePlainKey()` (via `randomBytes` from `node:crypto`)
- Uses `this.computeHmac(plainApiKey)` to produce the fingerprint
- Stores `key_fingerprint` (not `key_hash`)
- Does NOT load to Redis on create (the plain key is returned to user, backfill happens on first lookup)

**Old tests mock**:

- `jest.mock('bcrypt')` with `hash`/`compare`
- `jest.mock('crypto')` with `randomBytes` — intercepts the module-level export
- Assert `key_hash: 'HASHED'` in `transactionManager.create`

### 1.4 `findActiveByPlainKey()` — Complete Rewrite

**Current implementation** (Redis-first pattern):

1. Compute HMAC fingerprint of the plain key
2. Try Redis lookup (`api_key:fp:{fingerprint}`)
3. If cache hit → return `permissionCodes` string array
4. If miss → DB lookup via `findByFingerprint(fingerprint)` (O(1) indexed)
5. Backfill cache on DB hit
6. Returns `string[]` (permission codes), NOT the entity

**Old tests expect** (bcrypt O(N) scan):

1. Call `findAllActive()` to get all active keys
2. Loop and `bcrypt.compare()` against each `key_hash`
3. Returns the matching `ApiKeyEntity` object

### 1.5 `deactivate()` — Added Redis Invalidation

**Current**: Calls `this.invalidateApiKeyCache(apiKey)` before saving (requires `redis` and `logger`).
**Old tests**: No Redis mock, no logger mock → crashes with `Cannot read properties of undefined (reading 'warn')`.

### 1.6 `activate()` — New Method

**Current**: Exists with Redis `loadApiKeyToRedis()` integration.
**Old tests**: Not tested at all.

### 1.7 `changePermissions()` — New Method

**Current**: Exists with Redis `invalidateApiKeyCache()` call.
**Old tests**: Not tested at all.

### 1.8 `canDo()` — Return Type Change

**Current**: `findActiveByPlainKey()` returns `string[]`, so `canDo` calls `.includes()` directly.
**Old tests mock**: `findActiveByPlainKey` returns `{ permissionCodes: ['READ'] }` (entity-shaped) → `apiKeyPermissions.includes is not a function`.

### 1.9 `warmUpCache()` / `onModuleInit()` — New

**Current**: Service implements `OnModuleInit`, calls `warmUpCache()` which loads all active keys by fingerprint into Redis.
**Old tests**: Not tested.

### 1.10 `ApiCache` Interface — New

Located at `src/interfaces/api-cache.interface.ts`. Used in Redis cache serialization.

### 1.11 Repository — `findByFingerprint()` — New Method

Located at `api-keys.repository.ts:43`. Does indexed lookup on `key_fingerprint` + `active: true`.
**Old tests**: Repository mock doesn't include `findByFingerprint`.

### 1.12 Microservice Guard — Stale Comment

`microservice.guard.ts:42` still has the comment: `"Replicates the logic from ApiKeyGuard: extracts the key, checks it against the database via bcrypt comparison"` — this is outdated. The implementation already calls `findActiveByPlainKey()` which uses HMAC, not bcrypt.

---

## 2. Failing Tests (3 suites, 12 failures)

### 2.1 Unit Test: `api-keys.service.spec.ts` — 6 failures

| Test                                               | Root Cause                                                                                                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `creates API key and returns plaintext key`        | Wrong constructor (3 args vs 6), bcrypt mocks, `key_hash` assertion                                                                                            |
| `deactivate disables active API key`               | Missing `redis` and `logger` mocks → `Cannot read properties of undefined (reading 'warn')`                                                                    |
| `findActiveByPlainKey returns matching active key` | Missing `configService` mock → `Cannot read properties of undefined (reading 'getOrThrow')`. Also tests bcrypt O(N) scan pattern instead of HMAC + Redis-first |
| `findActiveByPlainKey throws when no key matches`  | Same root cause — TypeError before reaching the ApiKeyException                                                                                                |
| `canDo returns true when permission exists`        | `findActiveByPlainKey` mock returns entity shape `{ permissionCodes }` instead of `string[]`                                                                   |
| `canDo returns false when permission missing`      | Same as above                                                                                                                                                  |

### 2.2 Integration Test: `test/integration/pg-mem/api-keys.spec.ts` — 3 failures

All 3 tests fail with: `Nest can't resolve dependencies of ApiKeysService (..., ?, RedisService, winston)`.

- Missing providers: `ConfigService`, `RedisService`, `WINSTON_MODULE_PROVIDER`
- References `key_hash` field (no longer exists)
- Uses `bcrypt.compare()` for verification

### 2.3 Integration Test: `test/integration/testcontainers/api-keys.spec.ts` — 3 failures

Identical issues to the pg-mem integration test above.

---

## 3. Test Update Plan

### 3.1 Unit Test: `src/services/api-keys/api-keys.service.spec.ts` — Full Rewrite

**Changes needed:**

1. **Remove bcrypt mocks** — Delete `jest.mock('bcrypt')` and all bcrypt imports/references
2. **Update crypto mock** — Mock `node:crypto` (not `crypto`), mock both `randomBytes` and `createHmac`. The `createHmac` mock should return a chainable object: `{ update: () => ({ digest: () => 'FINGERPRINT' }) }`
3. **Update constructor** — Add mocks for `ConfigService`, `RedisService`, and `Logger` (WINSTON_MODULE_PROVIDER). Constructor call: `new ApiKeysService(repository, dataSource, permissionsService, configService, redis, logger)`
4. **Update `create` test** — Assert `key_fingerprint: 'FINGERPRINT'` instead of `key_hash: 'HASHED'`. Remove bcrypt hash assertion
5. **Update `deactivate` test** — Add Redis mock that handles `invalidateApiKeyCache()` (multi → del, sRem, exec)
6. **Add `activate` test** — Test that it calls `loadApiKeyToRedis()` and sets `active = true`
7. **Add `changePermissions` test** — Test permission reassignment + cache invalidation
8. **Rewrite `findActiveByPlainKey` tests** — Test the Redis-first → DB fallback → backfill flow:
   - Test: Redis cache hit → returns permission codes array
   - Test: Redis miss → DB hit → returns permission codes + backfills cache
   - Test: Redis miss → DB miss → throws `ApiKeyException`
   - Test: Redis error → falls back to DB gracefully
9. **Update `canDo` tests** — Mock `findActiveByPlainKey` to return `string[]` (e.g., `['READ']`) instead of entity shape
10. **Add `warmUpCache` test** — Test that all active keys are loaded into Redis on init
11. **Add `onModuleInit` test** — Test that `warmUpCache()` is called; test graceful failure handling

### 3.2 Integration Test: `test/integration/pg-mem/api-keys.spec.ts`

**Changes needed:**

1. **Add missing providers** to `Test.createTestingModule`:
   - `ConfigService` (mock with `getOrThrow('HMAC_SECRET')` returning a test secret)
   - `RedisService` (mock with `raw.get`, `raw.multi`, `raw.sMembers`, `raw.sAdd`)
   - `WINSTON_MODULE_PROVIDER` (mock logger with `info`, `warn`, `debug`, `error`)
2. **Remove bcrypt imports** — Delete `import { compare } from 'bcrypt'`
3. **Update `creates an API key` test** — Replace `key_hash` assertions with `key_fingerprint`. Replace `bcrypt.compare()` verification with HMAC verification (compute HMAC of plain key and compare to stored fingerprint)
4. **Update `canDo` test** — Now goes through Redis-first path; mock Redis appropriately or let it fall through to DB

### 3.3 Integration Test: `test/integration/testcontainers/api-keys.spec.ts`

**Same changes as pg-mem** (items 1-4 from section 3.2 above).

### 3.4 Controller Spec: `src/services/api-keys/api-keys.controller.spec.ts`

**Changes needed:**

1. **Add missing service methods** to the mock: `findOne`, `activate`, `changePermissions`
2. **Add test for `findOne`** — delegates to service
3. **Add test for `activate`** — delegates to service
4. **Add test for `changePermissions`** — delegates to service

### 3.5 New Test: `src/cron/api-keys-cache-reconciliation.service.spec.ts`

**Create new unit test** for the cron reconciliation service:

1. Test `handleCacheReconciliation()` calls `deleteStaleKeys()`
2. Test `deleteStaleKeys()` with empty fingerprints set → logs and returns
3. Test `deleteStaleKeys()` with fingerprints where some are stale → removes stale, keeps valid
4. Test error handling in reconciliation

---

## 4. Documentation Update Plan

### 4.1 `docs/authentication-flow.md`

| Line | Current (Outdated)                                                                | Should Be                                                                                                       |
| ---- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 121  | `"find active key via ApiKeysService.findActiveByPlainKey() (bcrypt comparison)"` | `"find active key via ApiKeysService.findActiveByPlainKey() (HMAC-SHA256 fingerprint lookup with Redis cache)"` |
| 145  | `"validated via bcrypt comparison against stored hashes"`                         | `"validated via HMAC-SHA256 fingerprint lookup with Redis-first caching"`                                       |

### 4.2 `README.md`

| Line | Current (Outdated)                        | Should Be                                      |
| ---- | ----------------------------------------- | ---------------------------------------------- |
| 51   | `"JWT (jsonwebtoken) + bcrypt + cookies"` | `"JWT (jsonwebtoken) + HMAC-SHA256 + cookies"` |

### 4.3 `docs/architecture.md`

**Missing content — additions needed:**

1. **Cron Jobs table** (line 103-108): Add row for `ApiKeysCacheReconciliationService` (hourly, removes stale API key cache entries)
2. **Redis section** (line 142-146): Add API key cache entries:
   - `api_key:fp:{fingerprint}` — JSON cache with client and permissionCodes
   - `api_keys` — Redis SET tracking all cached fingerprints (for reconciliation)
3. **Project Structure** in README.md: Add `api-keys-cache-reconciliation.service.ts` to the cron section

### 4.4 `src/common/guards/microservice.guard.ts`

**Line 42**: Stale JSDoc comment says `"checks it against the database via bcrypt comparison"`. Should say `"validates via HMAC-SHA256 fingerprint with Redis-first caching"`.

### 4.5 `README.md` — Environment Variables Table

**Missing**: `HMAC_SECRET` is not listed in the environment variables table (line 441+). It's already in `env-validation.ts` as a required field with `@MinLength(32)`.

### 4.6 `README.md` — API Keys Table

**Missing**: `PATCH /api-keys/activate/:id` and `PATCH /api-keys/change-permissions/:id` are not listed in the API Reference table (line 508-513). Also `GET /api-keys/find/:id` is missing.

---

## 5. Implementation Order

1. Unit test `api-keys.service.spec.ts` — full rewrite (highest impact, 6 failures)
2. Controller spec `api-keys.controller.spec.ts` — add missing methods
3. Integration test `pg-mem/api-keys.spec.ts` — add providers, update assertions
4. Integration test `testcontainers/api-keys.spec.ts` — same as pg-mem
5. New test `api-keys-cache-reconciliation.service.spec.ts`
6. Documentation updates (all files from section 4)
7. Run `npm run test` and `npm run build` to verify

---

## 6. Files Affected

### Tests (modify):

- `src/services/api-keys/api-keys.service.spec.ts`
- `src/services/api-keys/api-keys.controller.spec.ts`
- `test/integration/pg-mem/api-keys.spec.ts`
- `test/integration/testcontainers/api-keys.spec.ts`

### Tests (create):

- `src/cron/api-keys-cache-reconciliation.service.spec.ts`

### Documentation (modify):

- `docs/authentication-flow.md`
- `docs/architecture.md`
- `README.md`

### Source code (comment fix only):

- `src/common/guards/microservice.guard.ts` (line 42 — stale JSDoc)

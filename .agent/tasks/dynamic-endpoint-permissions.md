# Dynamic Endpoint Permissions

## Goal

Make endpoint permissions dynamic — database-driven + Redis-cached instead of hardcoded `@Permissions` decorators.

## User Requirements

1. Load ALL `endpoint_permission_rules` from DB into Redis on microservice startup (warm-up)
2. AuthGuard reads `@EndpointKey` from handler → Redis lookup → DB fallback
3. `@Permissions` decorator will eventually be REMOVED — DB fallback is mandatory
4. All Redis cache loading/invalidation functions MUST live in `EndpointPermissionRulesService`
5. When permissions are modified via admin API, update Redis immediately (replicate `refreshSessionPermissions` pattern)
6. Use `ModuleRef.get({ strict: false })` in AuthGuard to avoid circular dependency

## Phase 1: Foundation — Entity Fix & Repository Additions

- [ ] 1.1 **Fix ManyToMany inverse in EndpointPermissionRulesEntity**
  - File: `src/entities/endpoint-permission-rules.entity.ts` (line 33)
  - Change `(permission) => permission.roles` → `(permission) => permission.endpoint_permission_rules`

- [ ] 1.2 **Add `findByEndpointKey()` to repository**
  - File: `src/services/endpoint-permission-rules/endpoint-permission-rules.repository.ts`
  - Query by unique `endpoint_key_name`, returns entity or null

- [ ] 1.3 **Add `findAllEnabled()` to repository**
  - File: `src/services/endpoint-permission-rules/endpoint-permission-rules.repository.ts`
  - Filter by `enabled: true`, returns array with eager-loaded permissions

## Phase 2: Core — Redis Cache Methods in Service

- [ ] 2.1 **Inject RedisService + implement OnModuleInit**
  - File: `src/services/endpoint-permission-rules/endpoint-permission-rules.service.ts`
  - Add `RedisService` to constructor, `OnModuleInit` calls `warmUpCache()`
  - Helper: `redisKey(name) → "epr:{name}"`

- [ ] 2.2 **`warmUpCache()`** — bulk load all enabled rules to Redis on startup using `multi()`/`exec()` pipeline (1 round-trip, not N)
- [ ] 2.3 **`loadRuleToRedis(key)`** — load/refresh single rule (enabled → set, disabled/missing → del)
- [ ] 2.4 **`invalidateRuleCache(key)`** — delete key from Redis
- [ ] 2.5 **`getPermissionsForEndpoint(key)`** — Redis → DB fallback → backfill cache. Returns `string[] | null`

## Phase 3: Integration — Module Export & Mutation Wiring

- [ ] 3.1 **Export `EndpointPermissionRulesService` from module**
- [ ] 3.2 **Wire `loadRuleToRedis()` into `create()`**
- [ ] 3.3 **Wire into `update()` with key rename handling** (capture old key before merge)
- [ ] 3.4 **Wire `invalidateRuleCache()` into `delete()`**
- [ ] 3.5 **Wire `loadRuleToRedis()` into `assignPermissions()`**
- [ ] 3.6 **Wire `loadRuleToRedis()` into `enableRule()`**
- [ ] 3.7 **Wire `invalidateRuleCache()` into `disableRule()`**

## Phase 4: AuthGuard — Dynamic Permission Check Chain

- [ ] 4.1 **Add ModuleRef to AuthGuard constructor**
  - File: `src/middlewares/auth.middleware.ts`
  - Import `EndpointKey` decorator, `EndpointPermissionRulesService`
  - Cache resolved service instance

- [ ] 4.2 **Implement three-tier permission check in `canActivate()`**
  - Fallback chain: `@EndpointKey` (Redis → DB) → `@Permissions` (backward compat) → pass
  - Re-throw `AuthException`, catch all else gracefully

## Phase 5: Testing

- [ ] 5.1 Rewrite test setup with proper mocks (repository, permissions, redis)
- [ ] 5.2 Test `warmUpCache()` — happy path, no rules, empty permissions, Redis failure
- [ ] 5.3 Test `loadRuleToRedis()` — enabled, disabled, missing, Redis failure
- [ ] 5.4 Test `invalidateRuleCache()` — happy path, Redis failure
- [ ] 5.5 Test `getPermissionsForEndpoint()` — Redis hit, DB fallback, disabled, both fail
- [ ] 5.6 Test mutation cache invalidation wiring (all 7 mutations + failure resilience)

## Phase 6: Verification

- [ ] 6.1 `npm run build` — zero compilation errors
- [ ] 6.2 `npm run test` — zero regressions
- [ ] 6.3 `npm run format` — code style compliance

## Implementation Order (Critical Path)

```
1.1 → 1.2/1.3 → 2.1 → 2.2-2.5 → 3.1 → 4.1 → 4.2 → 5.x → 6.x
                                    3.2-3.7 (parallel with Phase 4)
```

## Key Design Decisions

- Redis key format: `epr:{endpoint_key_name}` → JSON string array of permission codes
- `ModuleRef.get({ strict: false })` — lazy resolution, cached on first use
- Cache failures are non-blocking (try/catch, console.error)
- Disabled rule = no dynamic rule → falls through to `@Permissions`
- Empty permissions array `[]` means "rule exists, zero permissions required" → grants access
- Warm-up failure doesn't block app bootstrap
- `OnModuleInit` for warm-up timing
- **Redis `multi()`/`exec()` pipeline** for bulk operations (e.g., `warmUpCache()` with N rules). Single-key operations use direct commands. Matches `sessions.service.ts` pattern.

## Risks

| Risk                             | Severity | Mitigation                               |
| -------------------------------- | -------- | ---------------------------------------- |
| Entity ManyToMany inverse bug    | High     | Fix first (Phase 1.1)                    |
| Key rename leaves orphaned cache | Medium   | Capture old key before merge in update() |
| Redis+DB both fail               | Low      | Fall through to @Permissions or pass     |
| Multi-instance inconsistency     | Medium   | Deferred — future Redis Pub/Sub          |

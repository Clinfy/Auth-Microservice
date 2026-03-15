# Fix Failing Tests — Detailed Plan

## Executive Summary

**19 tests fail across 3 suites**, all rooted in the same two causes:

1. **Missing `sendRegistrationMail` mock** in all 3 test files. The `register()` method calls `this.emailService.sendRegistrationMail(user.email, password)` inside a transaction, but no test file mocks this method. The call throws `TypeError: this.emailService.sendRegistrationMail is not a function`, which the blanket `catch` in `register()` swallows and re-throws as `UsersException: User registration failed`.

2. **`RegisterUserDTO` no longer has a `password` field**, but both integration test suites still pass `password` in the DTO. The service now auto-generates the password via `randomBytes(12).toString('hex')` (line 86 of `users.service.ts`). This means:
   - The `password` field in test DTOs is silently ignored (TypeScript structural typing allows it at runtime, but the entity won't receive a DTO password).
   - Any downstream test that calls `firstActivation()` with the "known" password from the DTO will fail because the actual stored password is a random hex string, not the value the test expects.

**Cascade effect**: In both integration suites, 8 of 9 tests depend on `register()` succeeding first (either directly or as a prerequisite). Because `register()` always fails, every dependent test also fails.

---

## Root Cause Analysis

### Suite 1: `src/services/users/users.service.spec.ts` (1 failure)

**Test**: `register › creates a user inside a transaction and returns a success message` (line 347)

**Root cause**: `emailServiceMock` (lines 60-63) mocks `sendResetPasswordMail` and `confirmPasswordChange` but does NOT mock `sendRegistrationMail`.

**Chain of events**:

1. `dataSource.transaction` mock (line 351) executes the callback.
2. Inside the callback, `userRepository.save` returns the mock (line 354).
3. `this.emailService.sendRegistrationMail(user.email, password)` is called — `sendRegistrationMail` is `undefined`.
4. `TypeError: this.emailService.sendRegistrationMail is not a function` is thrown.
5. The blanket `catch` in `register()` wraps it as `UsersException('User registration failed', USER_NOT_REGISTERED, 500)`.

**Secondary issue**: The test passes `password: 'P@ss1'` in the DTO (line 348), but `RegisterUserDTO` no longer has a `password` field. The test then asserts `expect.objectContaining({ password: dto.password })` (line 363) — this assertion verifies the DTO password was passed to `create()`. However, in the real service, `register()` generates its own password via `randomBytes(12).toString('hex')` and spreads it over the DTO (`{ ...dto, password }`). The mock `create` function does get called with a password property, but it's the random one, not `dto.password`. **This assertion would also fail even after fixing the mock**, since the password in the create call will be a random hex string, not `'P@ss1'`.

### Suite 2: `test/integration/pg-mem/users.spec.ts` (9 failures)

**All 9 tests depend on `register()` succeeding.** The `emailServiceMock` (lines 37-40) lacks `sendRegistrationMail`, causing the same `TypeError` → `UsersException` cascade.

| #   | Test (line)                                           | Direct failure or cascade?       | Additional issues after mock fix                                                                                                                                                                                         |
| --- | ----------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `registers a user and stores a hashed password` (145) | **Direct** — calls `register()`  | None after mock fix. DTO `password` field is ignored; service generates its own. Test checks stored hash matches `$2` pattern, which will pass.                                                                          |
| 2   | `logs in a user, stores a session` (164)              | **Cascade** — `register()` fails | After mock fix: `firstActivation` (line 174) is called with `password: 'Secret123'`, but the actual stored password is a random hex string. `compare()` will return false → `UsersException('Wrong email or password')`. |
| 3   | `assigns roles to a user` (205)                       | **Cascade** — `register()` fails | After mock fix: works (no `firstActivation` dependency).                                                                                                                                                                 |
| 4   | `refreshes an active session` (245)                   | **Cascade** — `register()` fails | After mock fix: works (no `firstActivation` dependency).                                                                                                                                                                 |
| 5   | `forgot password flow` (282)                          | **Cascade** — `register()` fails | After mock fix: works (no `firstActivation` dependency).                                                                                                                                                                 |
| 6   | `resets the password` (311)                           | **Cascade** — `register()` fails | After mock fix: works (no `firstActivation` dependency).                                                                                                                                                                 |
| 7   | `activates a user for the first time` (346)           | **Cascade** — `register()` fails | After mock fix: `firstActivation` uses `password: 'TempP@ss1'`, but actual password is random hex → `compare()` returns false → `UsersException`.                                                                        |
| 8   | `deactivates/reactivates a user` (369)                | **Cascade** — `register()` fails | After mock fix: Same `firstActivation` password mismatch issue.                                                                                                                                                          |
| 9   | `findAll returns all registered users` (415)          | **Cascade** — `register()` fails | After mock fix: works.                                                                                                                                                                                                   |

### Suite 3: `test/integration/testcontainers/users.spec.ts` (9 failures)

**Identical structure and issues** as the pg-mem suite. Same `emailServiceMock` missing `sendRegistrationMail`, same DTO `password` mismatches for `firstActivation`.

---

## Detailed Fix Plan

### Fix 1: Add `sendRegistrationMail` mock to all 3 test files

#### File: `src/services/users/users.service.spec.ts`

**Location**: lines 60-63 (emailService mock)

**Change**: Add `sendRegistrationMail` to the mock.

```typescript
// BEFORE (line 60-63):
emailService = {
  sendResetPasswordMail: jest.fn(),
  confirmPasswordChange: jest.fn(),
};

// AFTER:
emailService = {
  sendRegistrationMail: jest.fn().mockResolvedValue(undefined),
  sendResetPasswordMail: jest.fn(),
  confirmPasswordChange: jest.fn(),
};
```

#### File: `test/integration/pg-mem/users.spec.ts`

**Location**: lines 37-40 (emailServiceMock)

**Change**: Same — add `sendRegistrationMail`.

```typescript
// BEFORE (line 37-40):
const emailServiceMock = {
  sendResetPasswordMail: jest.fn(),
  confirmPasswordChange: jest.fn(),
};

// AFTER:
const emailServiceMock = {
  sendRegistrationMail: jest.fn().mockResolvedValue(undefined),
  sendResetPasswordMail: jest.fn(),
  confirmPasswordChange: jest.fn(),
};
```

#### File: `test/integration/testcontainers/users.spec.ts`

**Location**: lines 38-41 (emailServiceMock)

**Change**: Same — add `sendRegistrationMail`.

```typescript
// BEFORE (line 38-41):
const emailServiceMock = {
  sendResetPasswordMail: jest.fn(),
  confirmPasswordChange: jest.fn(),
};

// AFTER:
const emailServiceMock = {
  sendRegistrationMail: jest.fn().mockResolvedValue(undefined),
  sendResetPasswordMail: jest.fn(),
  confirmPasswordChange: jest.fn(),
};
```

### Fix 2: Update the unit test register assertion

#### File: `src/services/users/users.service.spec.ts`

**Location**: lines 346-367 (register test)

**Problem**: The test passes `password` in the DTO and asserts that `userRepository.create` was called with `password: dto.password`. But the service now:

1. Ignores any DTO password (DTO type doesn't have one).
2. Generates its own password via `randomBytes(12).toString('hex')`.
3. Calls `create({ ...dto, password, created_by: request.user })` where `password` is the generated one.

**Change**:

```typescript
// BEFORE (line 348-366):
const dto = { email: 'new@example.com', password: 'P@ss1', person_id: 'p-1' };
const request = { user: { id: 'admin-1' } } as any;

(dataSource.transaction as jest.Mock).mockImplementation(async (cb) => {
  return cb({});
});
(userRepository.save as jest.Mock).mockResolvedValue({ id: 'new-id', email: dto.email });

const result = await service.register(dto, request);

expect(result).toEqual({ message: 'User new@example.com created' });
expect(userRepository.create).toHaveBeenCalledWith(
  expect.objectContaining({
    email: dto.email,
    password: dto.password,
    person_id: dto.person_id,
  }),
);

// AFTER:
const dto: RegisterUserDTO = { email: 'new@example.com', person_id: 'p-1' };
const request = { user: { id: 'admin-1' } } as any;

(dataSource.transaction as jest.Mock).mockImplementation(async (cb) => {
  return cb({});
});
(userRepository.save as jest.Mock).mockResolvedValue({ id: 'new-id', email: dto.email });

const result = await service.register(dto, request);

expect(result).toEqual({ message: 'User new@example.com created' });
expect(userRepository.create).toHaveBeenCalledWith(
  expect.objectContaining({
    email: dto.email,
    person_id: dto.person_id,
    password: expect.any(String), // auto-generated hex password
    created_by: request.user,
  }),
);
expect(emailService.sendRegistrationMail).toHaveBeenCalledWith(dto.email, expect.any(String));
```

Also add the import for `RegisterUserDTO` at the top of the file (it's not currently imported).

### Fix 3: Remove `password` from integration test `register()` call DTOs

#### Both integration test files

The `RegisterUserDTO` type only has `email` and `person_id`. Remove the `password` field from all register calls. The TypeScript compiler wouldn't catch this at test-time because the tests use inline objects, but it's semantically wrong and misleading.

**All affected locations in `test/integration/pg-mem/users.spec.ts`**:

- Line 148-149: `{ email: 'alice@example.com', password: 'P@ssword123', person_id: randomUUID() }` → remove `password`
- Line 167-168: `{ email: 'bob@example.com', password: 'Secret123', person_id: randomUUID() }` → remove `password`
- Line 208-209: `{ email: 'carol@example.com', password: 'Secret123', person_id: randomUUID() }` → remove `password`
- Line 248-249: `{ email: 'frank@example.com', password: 'Secret123', person_id: randomUUID() }` → remove `password`
- Line 285-286: `{ email: 'dave@example.com', password: 'Secret123', person_id: randomUUID() }` → remove `password`
- Line 314-315: `{ email: 'erin@example.com', password: 'OldPassword1', person_id: randomUUID() }` → remove `password`
- Line 349-350: `{ email: 'grace@example.com', password: 'TempP@ss1', person_id: randomUUID() }` → remove `password`
- Line 372-373: `{ email: 'hank@example.com', password: 'TempP@ss1', person_id: randomUUID() }` → remove `password`
- Line 416: `{ email: 'julia@example.com', password: 'P@ssword1', person_id: randomUUID() }` → remove `password`

**Same changes in `test/integration/testcontainers/users.spec.ts`** — identical locations.

### Fix 4: Fix `firstActivation` tests that depend on knowing the password

#### Problem

3 tests in each integration suite call `firstActivation()` with a password that the test author _thought_ was the one stored during `register()`. But `register()` now generates a random password via `randomBytes(12).toString('hex')` — the test has no way to know it.

**Affected tests (both integration files)**:

1. `logs in a user...` — calls `firstActivation({ email: 'bob@example.com', password: 'Secret123', ... })`
2. `activates a user for the first time` — calls `firstActivation({ email: 'grace@example.com', password: 'TempP@ss1', ... })`
3. `deactivates/reactivates a user` — calls `firstActivation({ email: 'hank@example.com', password: 'TempP@ss1', ... })`

**Solution**: Capture the auto-generated password from the `sendRegistrationMail` mock and use it in `firstActivation()`.

```typescript
// Example for "logs in a user" test:
await usersService.register({ email: 'bob@example.com', person_id: randomUUID() }, request);

// Capture the auto-generated password from the email mock
const generatedPassword = emailServiceMock.sendRegistrationMail.mock.calls[0][1];

await usersService.firstActivation({
  email: 'bob@example.com',
  password: generatedPassword,
  new_password: 'N3wS3cret!',
});
```

**Important**: After each `beforeEach` that clears mocks (both integration files call `jest.clearAllMocks()`), the mock call history is reset. So the `sendRegistrationMail.mock.calls[0][1]` pattern works reliably within each test.

For the "activates a user for the first time" and "deactivates/reactivates" tests, apply the same pattern:

```typescript
// grace@example.com test
await usersService.register({ email: 'grace@example.com', person_id: randomUUID() }, request);
const generatedPassword = emailServiceMock.sendRegistrationMail.mock.calls[0][1];

const result = await usersService.firstActivation({
  email: 'grace@example.com',
  password: generatedPassword,
  new_password: 'N3wP@ssw0rd!',
});
```

```typescript
// hank@example.com test
await usersService.register({ email: 'hank@example.com', person_id: randomUUID() }, request);
const generatedPassword = emailServiceMock.sendRegistrationMail.mock.calls[0][1];

await usersService.firstActivation({
  email: 'hank@example.com',
  password: generatedPassword,
  new_password: 'N3wP@ssw0rd!',
});
```

### Fix 5: Update controller test DTO shape (low priority, but for correctness)

#### File: `src/services/users/users.controller.spec.ts`

**Location**: lines 44-47

The controller test passes `password: 'secret'` in the `RegisterUserDTO`. Since the controller test fully mocks the service and only verifies delegation, this doesn't cause a test failure. However, for type correctness it should be updated:

```typescript
// BEFORE (line 44-47):
const dto: RegisterUserDTO = {
  email: 'user@example.com',
  password: 'secret',
  person_id: '55555555-5555-5555-5555-555555555555',
};

// AFTER:
const dto: RegisterUserDTO = {
  email: 'user@example.com',
  person_id: '55555555-5555-5555-5555-555555555555',
};
```

**Note**: This currently "passes" because TypeScript's structural typing at test runtime doesn't enforce strict DTO shapes, and the test only checks `service.register` was called with the same object. But it's misleading — the DTO no longer carries a password.

---

## Summary of All Changes

| File                                            | Change                                                                                                         | Fixes tests         |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------- |
| `src/services/users/users.service.spec.ts`      | Add `sendRegistrationMail` mock; update register test DTO and assertions                                       | 1 unit test         |
| `test/integration/pg-mem/users.spec.ts`         | Add `sendRegistrationMail` mock; remove `password` from DTOs; capture generated password for `firstActivation` | 9 integration tests |
| `test/integration/testcontainers/users.spec.ts` | Same as pg-mem                                                                                                 | 9 integration tests |
| `src/services/users/users.controller.spec.ts`   | Remove `password` from DTO (correctness, not a failure fix)                                                    | 0 (preventive)      |

---

## Risk Assessment

### Tests that pass but test outdated behavior

1. **`users.controller.spec.ts` line 44**: `RegisterUserDTO` includes `password: 'secret'` which is no longer part of the DTO. The test passes because it mocks the service entirely and only checks delegation. TypeScript runtime doesn't enforce this at test-time. **Risk**: Misleading — a developer might think the API still accepts a password.

2. **Unit test `register` assertion (line 359-365)**: Even before this plan, the test asserted `password: dto.password` but the service generates its own password. However, this test currently fails anyway (due to the missing mock), so it's caught.

### Blanket catch in `register()` — known tech debt

The `register()` method's blanket `try/catch` (lines 96-102 of `users.service.ts`) replaces ALL errors with a generic `USER_NOT_REGISTERED`. This was already identified as a bug in memory. The fix plan does NOT address this; it only fixes the tests. The blanket catch should be addressed separately — it masks real errors and makes debugging extremely difficult (as this very investigation demonstrates).

### Custom validators `@IsUniqueEmail()` and `@IsUniquePerson()`

These validators are async and require a DataSource injection. In the unit tests, they don't execute because NestJS validation pipes are not involved (the service is called directly with plain objects). In the integration tests, they also don't execute for the same reason (no pipe). **No risk here**, but worth noting that the validators are only exercised through e2e/HTTP tests.

---

## Verification Steps

After applying all changes:

1. **Run the unit test suite**:

   ```bash
   npx jest --no-coverage src/services/users/users.service.spec.ts
   ```

   Expected: 33/33 pass.

2. **Run the pg-mem integration suite**:

   ```bash
   npx jest --no-coverage test/integration/pg-mem/users.spec.ts
   ```

   Expected: 9/9 pass.

3. **Run the testcontainers integration suite** (requires Docker):

   ```bash
   npx jest --no-coverage test/integration/testcontainers/users.spec.ts
   ```

   Expected: 9/9 pass.

4. **Run the full test suite**:

   ```bash
   npm run test
   ```

   Expected: 133/133 pass, 18/18 suites pass.

5. **Run the build** to confirm no type errors were introduced:

   ```bash
   npm run build
   ```

6. **Verify the controller test still passes** (should be unaffected or improved):
   ```bash
   npx jest --no-coverage src/services/users/users.controller.spec.ts
   ```

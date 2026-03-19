# Error Handling and Logging Improvements

## Problem Statement

The Auth-Microservice has two main issues with error handling:

1. **Error Context Loss**: Specific errors (e.g., "Permission with ID X not found") get wrapped in generic catch blocks and the user sees generic messages like "Permission assignment failed" instead of the actual problem.

2. **Inconsistent Logging**: There are 12 `console.error` calls across the codebase that bypass Winston entirely, making debugging difficult with no structure, correlation, or proper log levels.

## Proposed Solution

Implement error cause chaining using ES2022's `Error.cause` property and migrate all `console.error` calls to structured Winston logging.

---

## Phase 1: Error Cause Chaining

### Justification

By adding `cause` support to all exception handlers and updating the `AllExceptionsFilter` to traverse the cause chain, we can:

- Preserve the full error context for logging
- Surface the most specific user-facing message (from the deepest `HttpException`)
- Maintain backward compatibility (existing code without `cause` continues to work)

### Task 1.1: Create BaseServiceException Abstract Class

**File**: `src/common/exceptions/base-service.exception.ts` (NEW)

**Implementation**:

```typescript
import { HttpException, HttpStatus } from '@nestjs/common';

export interface ServiceExceptionResponse {
  message: string;
  errorCode: string;
  statusCode: number;
}

export abstract class BaseServiceException extends HttpException {
  constructor(message: string, errorCode: string, status: HttpStatus, cause?: Error) {
    const response: ServiceExceptionResponse = {
      message,
      errorCode,
      statusCode: status,
    };
    super(response, status, { cause });
  }

  getErrorCode(): string {
    const response = this.getResponse() as ServiceExceptionResponse;
    return response.errorCode;
  }

  static getDeepestHttpExceptionMessage(error: Error): string {
    let current: Error | undefined = error;
    let deepestHttpExceptionMessage: string =
      error instanceof HttpException ? error.message : 'An unexpected error occurred';

    while (current?.cause instanceof Error) {
      current = current.cause;
      if (current instanceof HttpException) {
        const response = current.getResponse();
        deepestHttpExceptionMessage = typeof response === 'string' ? response : (response as any).message || current.message;
      }
    }

    return deepestHttpExceptionMessage;
  }

  static getCauseChain(error: Error): Array<{ type: string; message: string }> {
    const chain: Array<{ type: string; message: string }> = [];
    let current: Error | undefined = error;

    while (current) {
      chain.push({
        type: current.constructor.name,
        message: current.message,
      });
      current = current.cause instanceof Error ? current.cause : undefined;
    }

    return chain;
  }

  /**
   * Extracts the errorCode from the deepest BaseServiceException in the cause chain.
   * Returns undefined if no BaseServiceException with errorCode is found in the chain.
   */
  static getDeepestErrorCode(error: Error): string | undefined {
    let current: Error | undefined = error;
    let deepestErrorCode: string | undefined;

    while (current) {
      if (current instanceof BaseServiceException) {
        deepestErrorCode = current.getErrorCode();
      }
      current = current.cause instanceof Error ? current.cause : undefined;
    }

    return deepestErrorCode;
  }
}
```

**Verification**:

- [ ] `npm run build` passes
- [ ] Unit tests for `getDeepestHttpExceptionMessage()` and `getCauseChain()`

---

### Tasks 1.2-1.8: Update Exception Handlers

Update each of the 7 exception handlers to extend `BaseServiceException` and accept optional `cause` parameter.

| Task | File                                                                                    | Current Base    | New Base               |
| ---- | --------------------------------------------------------------------------------------- | --------------- | ---------------------- |
| 1.2  | `src/services/roles/roles.exception.handler.ts`                                         | `HttpException` | `BaseServiceException` |
| 1.3  | `src/services/permissions/permissions.exception.handler.ts`                             | `HttpException` | `BaseServiceException` |
| 1.4  | `src/services/users/users.exception.handler.ts`                                         | `HttpException` | `BaseServiceException` |
| 1.5  | `src/middlewares/auth.exception.handler.ts`                                             | `HttpException` | `BaseServiceException` |
| 1.6  | `src/services/JWT/jwt.excpetion.handler.ts`                                             | `HttpException` | `BaseServiceException` |
| 1.7  | `src/services/api-keys/api-keys.exception.handler.ts`                                   | `HttpException` | `BaseServiceException` |
| 1.8  | `src/services/endpoint-permission-rules/endpoint-permission-rules.exception.handler.ts` | `HttpException` | `BaseServiceException` |

**Example transformation** (RolesException):

```typescript
// BEFORE
import { HttpException, HttpStatus } from '@nestjs/common';

export class RolesException extends HttpException {
  constructor(message: string, errorCode: RolesErrorCodes, status: HttpStatus) {
    super({ message, errorCode, statusCode: status }, status);
  }
}

// AFTER
import { HttpStatus } from '@nestjs/common';
import { BaseServiceException } from 'src/common/exceptions/base-service.exception';

export class RolesException extends BaseServiceException {
  constructor(message: string, errorCode: RolesErrorCodes, status: HttpStatus, cause?: Error) {
    super(message, errorCode, status, cause);
  }
}
```

**Verification**:

- [ ] `npm run build` passes after each handler update
- [ ] Existing tests pass (backward compatibility)

---

### Task 1.9: Enhance AllExceptionsFilter

**File**: `src/common/filters/all-exceptions.filter.ts`

**Changes**:

1. Import `BaseServiceException`
2. Use `getDeepestHttpExceptionMessage()` for user-facing message
3. Use `getDeepestErrorCode()` to extract cause's errorCode
4. Use `getCauseChain()` for structured logging
5. Add `causeCode` to response (backward compatible)

**Key code changes**:

```typescript
import { BaseServiceException } from 'src/common/exceptions/base-service.exception';

// In catch() method:

// Extract error code from top-level exception
let errorCode = 'INTERNAL_ERROR';
if (exception instanceof BaseServiceException) {
  errorCode = exception.getErrorCode();
} else if (exception instanceof HttpException) {
  const exceptionResponse = exception.getResponse() as any;
  errorCode = exceptionResponse.errorCode || 'INTERNAL_ERROR';
}

// Extract causeCode from deepest HttpException in chain
let causeCode: string | undefined;
if (exception instanceof Error) {
  causeCode = BaseServiceException.getDeepestErrorCode(exception);
  // Only include if different from errorCode
  if (causeCode === errorCode) {
    causeCode = undefined;
  }
}

// Get user-facing message from deepest HttpException
let userMessage = 'An unexpected error occurred';
if (exception instanceof Error) {
  userMessage = BaseServiceException.getDeepestHttpExceptionMessage(exception);
}

// Build cause chain for logging
const causeChain = exception instanceof Error ? BaseServiceException.getCauseChain(exception) : [];

// Enhanced Winston logging
this.logger.error('Unhandled exception', {
  exceptionType: exception?.constructor?.name,
  method: request.method,
  url: request.url,
  ip: request.ip,
  statusCode: status,
  errorCode,
  causeCode,
  userMessage,
  causeChain,
  stack: exception instanceof Error ? exception.stack : undefined,
});

// Response (backward compatible - causeCode only included when present)
response.status(status).json({
  statusCode: status,
  timestamp: new Date().toISOString(),
  path: request.url,
  errorCode,
  ...(causeCode && { causeCode }),
  message: userMessage,
});
```

**Example Response** (when cause exists):

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

**Example Response** (no cause or same code):

```json
{
  "statusCode": 404,
  "timestamp": "2026-03-18T12:00:00.000Z",
  "path": "/roles/123",
  "errorCode": "ROLE_NOT_FOUND",
  "message": "Role not found"
}
```

**Verification**:

- [ ] `npm run build` passes
- [ ] Integration test: nested exception returns specific message with causeCode
- [ ] Integration test: single exception returns response without causeCode

---

### Task 1.10: Update Service Catch Blocks

**Files**: ALL services with catch blocks that throw exceptions

**Example transformation** (assignPermissions):

```typescript
// BEFORE
async assignPermissions(roleId: string, dto: AssignPermissionDTO): Promise<RoleEntity> {
  try {
    const role = await this.findOne(roleId);
    role.permissions = await Promise.all(
      dto.permissionsIds.map((id) => this.permissionService.findOne(id))
    );
    // ...
  } catch (error) {
    throw new RolesException(
      'Permission assignment failed',
      RolesErrorCodes.ROLES_ASSIGN_ERROR,
      error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

// AFTER
async assignPermissions(roleId: string, dto: AssignPermissionDTO): Promise<RoleEntity> {
  try {
    const role = await this.findOne(roleId);
    role.permissions = await Promise.all(
      dto.permissionsIds.map((id) => this.permissionService.findOne(id))
    );
    // ...
  } catch (error) {
    // Preserve original error as cause for traceability
    throw new RolesException(
      'Permission assignment failed',
      RolesErrorCodes.ROLES_ASSIGN_ERROR,
      error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      error, // <-- ADD CAUSE
    );
  }
}
```

**Verification**:

- [ ] `npm run build` passes
- [ ] API returns "Permission not found" when invalid permission ID is passed

---

## Phase 2: Centralized Winston Logging

### Justification

Instead of injecting Winston in every service, we centralize error logging:

1. **Exceptions that are thrown**: Remove `console.error` — the `AllExceptionsFilter` already logs them via Winston
2. **Silent catches (no throw)**: Only these need Winston injection to log non-critical failures

This approach minimizes changes and keeps logging centralized.

### Strategy by `console.error` Type

| Type                            | Action                       | Rationale                                |
| ------------------------------- | ---------------------------- | ---------------------------------------- |
| `console.error` + `throw`       | **Remove** the console.error | Filter logs the exception                |
| `console.error` without `throw` | **Replace** with Winston     | Need explicit logging for silent catches |

### Task 2.1: Audit and Categorize console.error Calls

First, identify which `console.error` calls fall into each category:

| File                                   | Location            | Has throw? | Action               |
| -------------------------------------- | ------------------- | ---------- | -------------------- |
| `endpoint-permission-rules.service.ts` | Cache warmup        | No         | Replace with Winston |
| `endpoint-permission-rules.service.ts` | Redis fallback      | No         | Replace with Winston |
| `roles.service.ts`                     | Session refresh     | No         | Replace with Winston |
| `users.service.ts`                     | Session permissions | No         | Replace with Winston |
| `email.service.ts`                     | Email sending       | Check      | Remove or Replace    |
| `redis.service.ts`                     | Redis connection    | Check      | Remove or Replace    |
| `outbox-publisher.service.ts`          | Event publishing    | Check      | Remove or Replace    |

**Verification**:

- [ ] All 12 `console.error` calls categorized

---

### Task 2.2: Remove console.error Where Exceptions Are Thrown

For catches that already throw an exception, simply delete the `console.error` line.

```typescript
// BEFORE
catch (error) {
  console.error('Something failed', error);
  throw new SomeException(...);
}

// AFTER
catch (error) {
  throw new SomeException(..., error); // cause added in Phase 1
}
```

The `AllExceptionsFilter` will log the full cause chain via Winston.

**Verification**:

- [ ] `npm run build` passes
- [ ] Exceptions still logged in `logs/error.log`

---

### Task 2.3: Add Winston to Services with Silent Catches

Only inject Winston in services that have catches **without** throw. These are non-critical operations where we want to log but continue execution.

**Services requiring Winston injection**:

```typescript
import { Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class EndpointPermissionRulesService {
  constructor(
    // ... existing deps
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}
}
```

**Replace silent console.error**:

```typescript
// BEFORE
catch (error) {
  console.error('Cache warmup failed', error);
  // continues execution (no throw)
}

// AFTER
catch (error) {
  this.logger.warn('Cache warmup failed', {
    context: 'EndpointPermissionRulesService',
    operation: 'warmUpCache',
    error: error instanceof Error ? error.message : String(error),
  });
  // continues execution
}
```

**Log level guidance**:

- `warn`: Non-critical failures that don't block the main operation
- `error`: Only if the failure is critical (but then it should probably throw)

**Verification**:

- [ ] `npm run build` passes
- [ ] Winston injected only in services with silent catches
- [ ] Unit tests mock `WINSTON_MODULE_PROVIDER`

---

### Task 2.4: Final Verification

**Command**: `grep -rn "console.error" src/ --include="*.ts" | grep -v ".spec.ts"`

**Expected result**: 0 matches ✅

---

## Files Changed Summary

| Phase | Files                                             | Action                               |
| ----- | ------------------------------------------------- | ------------------------------------ |
| 1     | `src/common/exceptions/base-service.exception.ts` | CREATE                               |
| 1     | 7 exception handlers                              | MODIFY (extend BaseServiceException) |
| 1     | `src/common/filters/all-exceptions.filter.ts`     | MODIFY (cause chain + causeCode)     |
| 1     | 6 services with catch blocks                      | MODIFY (add cause parameter)         |
| 2     | 5 services with silent catches                    | MODIFY (Winston injection)           |
| 2     | `src/clients/email/email.service.ts`              | MODIFY (removed try/catch)           |

**Total**: 1 new file, ~20 modified files

---

## Verification Commands

```bash
# Build check
npm run build

# Run tests
npm run test

# Verify no console.error in production code
grep -rn "console.error" src/ --include="*.ts" | grep -v ".spec.ts"

# Format code
npm run format
```

---

## Acceptance Criteria

### Phase 1 ✅

- [x] `BaseServiceException` class created with cause support
- [x] `BaseServiceException.getDeepestErrorCode()` method implemented
- [x] All 7 exception handlers extend `BaseServiceException`
- [x] `AllExceptionsFilter` traverses cause chain
- [x] API response shows specific message (e.g., "Permission not found")
- [x] API response includes `causeCode` when cause differs from `errorCode`
- [x] API response omits `causeCode` when no cause or same code
- [x] Full cause chain logged in Winston
- [x] `npm run build` passes
- [x] `npm run test` passes

### Phase 2 ✅

- [x] All `console.error` calls with throw removed (filter handles logging)
- [x] Winston injected only in services with silent catches
- [x] Structured metadata in silent catch logs
- [x] Zero `console.error` in `src/` (excluding tests)
- [x] `npm run build` passes
- [x] `npm run test` passes

---

## Implementation Completed

1. ✅ **Task 1.1**: Created `BaseServiceException` (foundation)
2. ✅ **Tasks 1.2-1.8**: Updated 7 exception handlers
3. ✅ **Task 1.9**: Updated `AllExceptionsFilter` with cause chain + causeCode
4. ✅ **Task 1.10**: Updated all service catch blocks (added cause parameter)
5. ✅ **Task 2.1**: Audited all `console.error` calls
6. ✅ **Task 2.2**: Removed `console.error` where exceptions are thrown
7. ✅ **Task 2.3**: Added Winston to services with silent catches
8. ✅ **Task 2.4**: Verified zero `console.error` in production code

---

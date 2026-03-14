import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { RequestWithUser } from 'src/interfaces/request-user';
import { JwtService } from 'src/services/JWT/jwt.service';
import { Permissions } from 'src/middlewares/decorators/permissions.decorator';
import { RequestContextService } from 'src/common/context/request-context.service';
import { Session } from 'src/interfaces/session.interface';
import { AuthUser } from 'src/interfaces/auth-user.interface';
import { RedisService } from 'src/common/redis/redis.service';
import { extractApiKey } from 'src/common/tools/extract-api-key';
import { ApiKeysService } from 'src/services/api-keys/api-keys.service';
import { AuthErrorCodes, AuthException } from 'src/middlewares/auth.exception.handler';

@Injectable()
export class MicroserviceGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly requestContextService: RequestContextService,
    private readonly redis: RedisService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: RequestWithUser = context.switchToHttp().getRequest();

    // Step 1: Validate API key from the calling microservice
    await this.validateApiKey(context, request);

    // Step 2: Validate Bearer token of the user
    await this.validateUserToken(request);

    return true;
  }

  /**
   * Validates the API key from the `x-api-key` header.
   * Replicates the logic from ApiKeyGuard: extracts the key, checks it against
   * the database via bcrypt comparison, and verifies required permissions.
   */
  private async validateApiKey(context: ExecutionContext, request: RequestWithUser): Promise<void> {
    const rawApiKey = extractApiKey(request);

    // Resolve ApiKeysService lazily to avoid static module import dependencies
    const apiKeysService = this.moduleRef.get(ApiKeysService, {
      strict: false,
    });
    const apiKey = await apiKeysService.findActiveByPlainKey(rawApiKey);
    if (!apiKey) {
      throw new AuthException('Invalid API key', AuthErrorCodes.API_KEY_INVALID, HttpStatus.UNAUTHORIZED);
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(Permissions, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return;
    }

    const apiKeyPermissions = apiKey.permissionCodes;
    const hasAllPermissions = requiredPermissions.some((permission) => apiKeyPermissions.includes(permission));

    if (!hasAllPermissions) {
      throw new AuthException(
        'Insufficient API key permissions',
        AuthErrorCodes.INSUFFICIENT_PERMISSIONS,
        HttpStatus.FORBIDDEN,
      );
    }
  }

  /**
   * Validates the Bearer token from the `Authorization` header.
   * Replicates the JWT + Redis session logic from AuthGuard, but WITHOUT
   * IP/subnet verification (the request comes from a microservice, not the
   * original user).
   */
  private async validateUserToken( request: RequestWithUser): Promise<void> {
    const authorizationHeader = request.headers?.authorization;
    if (typeof authorizationHeader !== 'string' || authorizationHeader.trim().length === 0) {
      throw new AuthException('Authorization header missing', AuthErrorCodes.AUTH_HEADER_MISSING, HttpStatus.UNAUTHORIZED);
    }

    const [scheme, token] = authorizationHeader.trim().split(/\s+/);
    if (!/^Bearer$/i.test(scheme) || !token) {
      throw new AuthException(
        'Invalid authorization header format',
        AuthErrorCodes.AUTH_HEADER_INVALID,
        HttpStatus.UNAUTHORIZED,
      );
    }

    const payload = await this.jwtService.getPayload(token.trim(), 'auth');

    const sid = payload.sid;
    const sessionKey = `auth_session:${sid ?? token.trim()}`;

    const raw = await this.redis.raw.get(sessionKey);
    const session: Session | null = raw ? JSON.parse(raw) : null;

    if (!session) {
      throw new AuthException('Session expired or invalid', AuthErrorCodes.SESSION_INVALID, HttpStatus.UNAUTHORIZED);
    }
    if (!session.active) {
      throw new AuthException('This session is no longer active', AuthErrorCodes.SESSION_EXPIRED, HttpStatus.UNAUTHORIZED);
    }
    if (session.email !== payload.email) {
      throw new AuthException('Token/Session mismatch', AuthErrorCodes.SESSION_TOKEN_MISMATCH, HttpStatus.UNAUTHORIZED);
    }

    // NOTE: No IP/subnet verification — the request comes from a microservice,
    // not the original user client.

    const authUser: AuthUser = {
      id: session.user_id,
      email: session.email,
      person_id: session.person_id,
      session_id: sid ?? token.trim(),
    };

    request.user = authUser;
    this.requestContextService.setUser(authUser);
  }
}

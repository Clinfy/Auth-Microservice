import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { RequestWithUser } from 'src/interfaces/request-user';
import { JwtService } from 'src/services/JWT/jwt.service';
import { EndpointKey } from './decorators/endpoint-key.decorator';
import { RequestContextService } from 'src/common/context/request-context.service';
import { Session } from 'src/interfaces/session.interface';
import { AuthUser } from 'src/interfaces/auth-user.interface';
import { RedisService } from 'src/common/redis/redis.service';
import { getClientIp } from 'src/common/tools/get-client-ip';
import { sameSubnetCheck } from 'src/common/tools/same-subnet-check';
import { AuthErrorCodes, AuthException } from 'src/middlewares/auth.exception.handler';
import { EndpointPermissionRulesService } from 'src/services/endpoint-permission-rules/endpoint-permission-rules.service';

@Injectable()
export class AuthGuard implements CanActivate {
  private endpointPermissionRulesService?: EndpointPermissionRulesService;

  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly requestContextService: RequestContextService,
    private readonly redis: RedisService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: RequestWithUser = context.switchToHttp().getRequest();

    const token = this.extractToken(request);
    if (!token) {
      throw new AuthException(
        'Authentication cookie is missing, expired, or invalid',
        AuthErrorCodes.AUTH_COOKIE_EXPIRED_INVALID,
        HttpStatus.UNAUTHORIZED,
      );
    }

    const payload = await this.jwtService.getPayload(token, 'auth');
    // Checks Permission via Redis cached session
    const sid = payload.sid;
    const sessionKey = `auth_session:${sid ?? token}`;

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

    if (!sameSubnetCheck(session.ip, getClientIp(request))) {
      throw new AuthException('Session IP mismatch', AuthErrorCodes.SESSION_IP_MISMATCH, HttpStatus.UNAUTHORIZED);
    }

    const authUser: AuthUser = {
      id: session.user_id,
      email: session.email,
      person_id: session.person_id,
      session_id: sid ?? token,
    };

    request.user = authUser;
    this.requestContextService.setUser(authUser);

    //Dynamic endpoint permission rules (@EndpointKey decorator)
    const endpointKey = this.reflector.getAllAndOverride<string>(EndpointKey, [context.getHandler(), context.getClass()]);

    if (endpointKey) {

      this.endpointPermissionRulesService ??= this.moduleRef.get(EndpointPermissionRulesService, { strict: false });
      const dynamicPermissions = await this.endpointPermissionRulesService.getPermissionsForEndpoint(endpointKey);

      if (dynamicPermissions) {
        if (dynamicPermissions.length == 0) {
          return true;
        }

        const hasDynamicPermission = dynamicPermissions.some((permission) => session.permissions.includes(permission));

        if (!hasDynamicPermission) {
          throw new AuthException(
            'Insufficient permissions',
            AuthErrorCodes.INSUFFICIENT_PERMISSIONS,
            HttpStatus.FORBIDDEN,
          );
        }

          return true;
      }
    }
    return true;
  }

  private extractToken(request: RequestWithUser): string | null {
    return request.cookies?.['auth_token'] ?? null;
  }
}

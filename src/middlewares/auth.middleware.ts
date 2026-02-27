import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestWithUser } from 'src/interfaces/request-user';
import { JwtService } from 'src/services/JWT/jwt.service';
import { Permissions } from './decorators/permissions.decorator';
import { RequestContextService } from 'src/common/context/request-context.service';
import { Session } from 'src/interfaces/session.interface';
import { AuthUser } from 'src/interfaces/auth-user.interface';
import { RedisService } from 'src/common/redis/redis.service';
import { getClientIp } from 'src/common/tools/get-client-ip';
import { sameSubnetCheck } from 'src/common/tools/same-subnet-check';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly reflector: Reflector,
        private readonly requestContextService: RequestContextService,

        private readonly redis: RedisService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request: RequestWithUser = context.switchToHttp().getRequest();

        const authorizationHeader = request.headers?.authorization;
        if (typeof authorizationHeader !== 'string' || authorizationHeader.trim().length === 0) {
            throw new UnauthorizedException({
              message: 'Authorization header missing',
              code: 'AUTH_HEADER_MISSING',
              statusCode: 401,
            });
        }

        const [scheme, token] = authorizationHeader.trim().split(/\s+/);
        if (!/^Bearer$/i.test(scheme) || !token) {
            throw new UnauthorizedException({
              message: 'Invalid authorization header format',
              code: 'AUTH_HEADER_INVALID',
              statusCode: 401,
            });
        }

        const payload = await this.jwtService.getPayload(token.trim(), 'auth');
        // Checks Permission via Redis cached session
        const sid = payload.sid;
        const sessionKey = `auth_session:${sid ?? token.trim()}`;

        const raw = await this.redis.raw.get(sessionKey);
        const session: Session | null = raw ? JSON.parse(raw) : null;

        if (!session) {
          throw new UnauthorizedException({
            message: 'Session expired or invalid',
            code: 'SESSION_INVALID',
            statusCode: 401,
          });
        }
        if(!session.active) {
          throw new UnauthorizedException({
            message: 'This session is no longer active',
            code: 'SESSION_EXPIRED',
            statusCode: 401,
          });
        }
        if (session.email !== payload.email) {
          throw new UnauthorizedException({
            message: 'Token/Session mismatch',
            code: 'SESSION_TOKEN_MISMATCH',
            statusCode: 401,
          });
        }

        if(!sameSubnetCheck(session.ip, getClientIp(request))) {
          throw new UnauthorizedException({
            message: 'Session IP mismatch',
            code: 'SESSION_IP_MISMATCH',
            statusCode: 401,
          });
        }

        const authUser: AuthUser = {
          id: session.user_id,
          email: session.email,
          person_id: session.person_id,
          session_id: sid ?? token.trim(),
        };

        request.user = authUser;
        this.requestContextService.setUser(authUser)

        const permissions = this.reflector.getAllAndOverride<string[]>(Permissions, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!permissions || permissions.length === 0) {
            return true;
        }

        const hasAllPermissions = permissions.some(permission => session.permissions.includes(permission));

        if (!hasAllPermissions) {
            throw new ForbiddenException('Insufficient permissions');
        }

        return true;
    }
}

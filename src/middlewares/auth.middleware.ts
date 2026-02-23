import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { RequestWithUser } from 'src/interfaces/request-user';
import { JwtService } from 'src/services/JWT/jwt.service';
import { Permissions } from './decorators/permissions.decorator';
import { RequestContextService } from 'src/common/context/request-context.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Session } from 'src/interfaces/session.interface';
import { AuthUser } from 'src/interfaces/auth-user.interface';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly reflector: Reflector,
        private readonly moduleRef: ModuleRef,
        private readonly requestContextService: RequestContextService,

        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request: RequestWithUser = context.switchToHttp().getRequest();

        const authorizationHeader = request.headers?.authorization;
        if (typeof authorizationHeader !== 'string' || authorizationHeader.trim().length === 0) {
            throw new UnauthorizedException('Authorization header missing');
        }

        const [scheme, token] = authorizationHeader.trim().split(/\s+/);
        if (!/^Bearer$/i.test(scheme) || !token) {
            throw new UnauthorizedException('Invalid authorization header format');
        }

        const payload = await this.jwtService.getPayload(token.trim(), 'auth');
        // Resolve UsersService lazily to avoid static module import dependencies
        const sid = payload.sid;
        const sessionKey = `auth_session:${sid ?? token.trim()}`;

        const session = await this.cacheManager.get<Session>(sessionKey);

        if (!session) {
          throw new UnauthorizedException('Session expired or invalid');
        }
        if(!session.active) {
          throw new UnauthorizedException('This session is no longer active');
        }
        if (session.email !== payload.email) {
          throw new UnauthorizedException('Token/Session mismatch');
        }

        const authUser: AuthUser = {
          id: session.id,
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

import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { RequestWithUser } from 'src/interfaces/request-user';
import { JwtService } from 'src/services/JWT/jwt.service';
import { Permissions } from './decorators/permissions.decorator';
import { UsersService } from 'src/services/users/users.service';
import { RequestContextService } from 'src/common/context/request-context.service';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly reflector: Reflector,
        private readonly moduleRef: ModuleRef,
        private readonly requestContextService: RequestContextService,
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
        const usersService = this.moduleRef.get(UsersService, { strict: false });
        const user = await usersService.findByEmail(payload.email);
        if (!user) {
            throw new UnauthorizedException('Wrong email or password');
        }

        if (!user.active) {
            throw new UnauthorizedException('This user is not active');
        }

        request.user = user;
        this.requestContextService.setCurrentUser(user);

        const permissions = this.reflector.getAllAndOverride<string[]>(Permissions, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!permissions || permissions.length === 0) {
            return true;
        }

        const userPermissions = user.permissionCodes;
        const hasAllPermissions = permissions.some(permission => userPermissions.includes(permission));

        if (!hasAllPermissions) {
            throw new ForbiddenException('Insufficient permissions');
        }

        return true;
    }
}

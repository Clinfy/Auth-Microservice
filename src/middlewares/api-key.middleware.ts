import {CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException} from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { RequestWithApiKey } from 'src/interfaces/request-api-key';
import {Permissions} from "src/middlewares/decorators/permissions.decorator";
import {extractApiKey} from "src/common/tools/extract-api-key";

@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly moduleRef: ModuleRef,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request: RequestWithApiKey = context.switchToHttp().getRequest();
        const rawApiKey = extractApiKey(request);

        // Resolve ApiKeysService lazily to avoid static module import dependencies
        const apiKeysService = this.moduleRef.get<any>('ApiKeysService', { strict: false });
        const apiKey = await apiKeysService.findActiveByPlainKey(rawApiKey);
        if (!apiKey) {
            throw new UnauthorizedException('Invalid API key');
        }

        request.apiKey = apiKey;

        const requiredPermissions = this.reflector.getAllAndOverride<string[]>(Permissions, [
            context.getHandler(),
            context.getClass(),
        ]);


        if (!requiredPermissions || requiredPermissions.length === 0) {
            return true;
        }

        const apiKeyPermissions = apiKey.permissionCodes;
        const hasAllPermissions = requiredPermissions.some(permission => apiKeyPermissions.includes(permission));

        if (!hasAllPermissions) {
            throw new ForbiddenException('Insufficient API key permissions');
        }

        return true;
    }
}

import {CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeysService } from 'src/services/api-keys/api-keys.service';
import { RequestWithApiKey } from 'src/interfaces/request-api-key';
import {Permissions} from "src/middlewares/decorators/permissions.decorator";
import {extractApiKey} from "src/common/tools/extract-api-key";

@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(
        private readonly apiKeysService: ApiKeysService,
        private readonly reflector: Reflector,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request: RequestWithApiKey = context.switchToHttp().getRequest();
        const rawApiKey = extractApiKey(request);

        const apiKey = await this.apiKeysService.findActiveByPlainKey(rawApiKey);
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
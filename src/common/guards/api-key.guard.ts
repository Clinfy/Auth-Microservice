import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { RequestWithApiKey } from 'src/interfaces/request-api-key';
import { extractApiKey } from 'src/common/utils/extract-api-key.util';
import { ApiKeysService } from 'src/services/api-keys/api-keys.service';
import { AuthErrorCodes, AuthException } from 'src/common/guards/auth.exception';
import { EndpointPermissionRulesService } from 'src/services/endpoint-permission-rules/endpoint-permission-rules.service';
import { EndpointKey } from 'src/common/decorators/endpoint-key.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private endpointPermissionRulesService?: EndpointPermissionRulesService;
  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: RequestWithApiKey = context.switchToHttp().getRequest();
    const rawApiKey = extractApiKey(request);

    // Resolve ApiKeysService lazily to avoid static module import dependencies
    const apiKeysService = this.moduleRef.get(ApiKeysService, {
      strict: false,
    });
    const apiKeyPermissions = await apiKeysService.findActiveByPlainKey(rawApiKey);
    if (!apiKeyPermissions) {
      throw new AuthException('Invalid API key', AuthErrorCodes.API_KEY_INVALID, HttpStatus.UNAUTHORIZED);
    }

    const endpointKey = this.reflector.getAllAndOverride<string>(EndpointKey, [context.getHandler(), context.getClass()]);

    if (endpointKey) {
      this.endpointPermissionRulesService ??= this.moduleRef.get(EndpointPermissionRulesService, { strict: false });
      const dynamicPermissions = await this.endpointPermissionRulesService.getPermissionsForEndpoint(endpointKey);

      if (dynamicPermissions) {
        if (dynamicPermissions.length == 0) {
          return true;
        }

        const hasDynamicPermission = dynamicPermissions.some((permission) => apiKeyPermissions.includes(permission));

        if (!hasDynamicPermission) {
          throw new AuthException(
            'Insufficient API Key permissions',
            AuthErrorCodes.INSUFFICIENT_PERMISSIONS,
            HttpStatus.FORBIDDEN,
          );
        }

        return true;
      }
    }

    return true;
  }
}

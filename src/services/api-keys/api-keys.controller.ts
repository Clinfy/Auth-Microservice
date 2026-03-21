import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiKeyEntity } from 'src/entities/api-key.entity';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { CreateApiKeyDTO } from 'src/interfaces/DTO/api-key.dto';
import { ApiKeysService } from './api-keys.service';
import * as requestWithApi from 'src/interfaces/request-api-key';
import * as requestUser from 'src/interfaces/request-user';
import { EndpointKey } from 'src/common/decorators/endpoint-key.decorator';
import { AssignPermissionDTO } from 'src/interfaces/DTO/assign.dto';

@ApiTags('API Keys')
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @ApiOperation({
    summary: 'Return if an API key have permissions to do something',
  })
  @ApiHeader({ name: 'x-api-key', required: true })
  @ApiOkResponse({ schema: { type: 'boolean' } })
  @ApiUnauthorizedResponse({ description: 'API key header missing or invalid' })
  @ApiForbiddenResponse({ description: 'Invalid or inactive API key' })
  @Get('can-do/:permission')
  canDo(@Req() request: requestWithApi.RequestWithApiKey, @Param('permission') permission: string): Promise<boolean> {
    return this.apiKeysService.canDo(request, permission);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('api-key.generate')
  @ApiCookieAuth('auth_token')
  @ApiOperation({ summary: 'Create a new API key' })
  @ApiCreatedResponse({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        apiKey: { type: 'string' },
        client: { type: 'string' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Permission not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Post('generate')
  generate(
    @Req() response: requestUser.RequestWithUser,
    @Body() dto: CreateApiKeyDTO,
  ): Promise<{ apiKey: string; id: string; client: string }> {
    return this.apiKeysService.create(dto, response);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('api-key.find')
  @UseInterceptors(ClassSerializerInterceptor)
  @Get('find/:id')
  findOne(@Param('id') id: string): Promise<ApiKeyEntity> {
    return this.apiKeysService.findOne(id);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('api-key.find')
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiCookieAuth('auth_token')
  @ApiOperation({ summary: 'List all API keys' })
  @ApiOkResponse({ type: [ApiKeyEntity] })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Get('all')
  findAll(): Promise<ApiKeyEntity[]> {
    return this.apiKeysService.findAll();
  }

  @UseGuards(AuthGuard)
  @EndpointKey('api-key.update')
  @UseInterceptors(ClassSerializerInterceptor)
  @Patch('change-permissions/:id')
  changePermissions(@Param('id') id: string, @Body() dto: AssignPermissionDTO): Promise<ApiKeyEntity> {
    return this.apiKeysService.changePermissions(id, dto);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('api-key.deactivate')
  @ApiCookieAuth('auth_token')
  @ApiOperation({ summary: 'Deactivate an API key' })
  @ApiOkResponse({
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  @ApiNotFoundResponse({ description: 'API key not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Patch('deactivate/:id')
  deactivate(@Param('id') id: string): Promise<{ message: string }> {
    return this.apiKeysService.deactivate(id);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('api-key.activate')
  @ApiCookieAuth('auth_token')
  @ApiOperation({ summary: 'Activate an API key' })
  @ApiOkResponse({
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  @ApiNotFoundResponse({ description: 'API key not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Patch('activate/:id')
  activate(@Param('id') id: string): Promise<{ message: string }> {
    return this.apiKeysService.activate(id);
  }
}

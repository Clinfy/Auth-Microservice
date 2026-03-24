import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiKeyEntity } from 'src/entities/api-key.entity';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { CreateApiKeyDTO } from 'src/interfaces/DTO/api-key.dto';
import { ApiKeysService } from './api-keys.service';
import * as requestWithApi from 'src/interfaces/request-api-key';
import * as requestUser from 'src/interfaces/request-user';
import { EndpointKey } from 'src/common/decorators/endpoint-key.decorator';
import { AssignPermissionDTO } from 'src/interfaces/DTO/assign.dto';
import { PaginatedResponseDto, PaginationQueryDto } from 'src/interfaces/DTO/pagination.dto';

@ApiTags('API Keys')
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @ApiSecurity('api-key')
  @ApiHeader({ name: 'x-api-key', required: true, description: 'API key for machine-to-machine authentication' })
  @ApiOperation({
    summary: 'Return if an API key has permissions to do something',
    description: 'Checks whether the provided API key (via X-API-Key header) holds the specified permission code.',
  })
  @ApiParam({ name: 'permission', description: 'Permission code to check', example: 'USERS_CREATE' })
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
  @ApiCookieAuth('auth_token')
  @ApiOperation({ summary: 'Find an API key by ID' })
  @ApiParam({ name: 'id', description: 'API key UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiOkResponse({ type: ApiKeyEntity })
  @ApiNotFoundResponse({ description: 'API key not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Get('find/:id')
  findOne(@Param('id') id: string): Promise<ApiKeyEntity> {
    return this.apiKeysService.findOne(id);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('api-key.find')
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiCookieAuth('auth_token')
  @ApiOperation({ summary: 'List all API keys' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiExtraModels(ApiKeyEntity)
  @ApiOkResponse({
    description: 'Paginated list of API keys',
    schema: {
      properties: {
        data: { type: 'array', items: { $ref: getSchemaPath(ApiKeyEntity) } },
        total: { type: 'integer', example: 42 },
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 20 },
        totalPages: { type: 'integer', example: 3 },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Get('all')
  findAll(@Query() query: PaginationQueryDto): Promise<PaginatedResponseDto<ApiKeyEntity>> {
    return this.apiKeysService.findAll(query);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('api-key.update')
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiCookieAuth('auth_token')
  @ApiOperation({ summary: 'Update permissions assigned to an API key' })
  @ApiParam({ name: 'id', description: 'API key UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiOkResponse({ type: ApiKeyEntity })
  @ApiNotFoundResponse({ description: 'API key or permission not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Patch('change-permissions/:id')
  changePermissions(@Param('id') id: string, @Body() dto: AssignPermissionDTO): Promise<ApiKeyEntity> {
    return this.apiKeysService.changePermissions(id, dto);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('api-key.deactivate')
  @ApiCookieAuth('auth_token')
  @ApiOperation({ summary: 'Deactivate an API key' })
  @ApiParam({ name: 'id', description: 'API key UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
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
  @ApiParam({ name: 'id', description: 'API key UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
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

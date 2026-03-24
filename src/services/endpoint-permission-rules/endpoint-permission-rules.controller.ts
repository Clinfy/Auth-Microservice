import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { EndpointPermissionRulesService } from 'src/services/endpoint-permission-rules/endpoint-permission-rules.service';
import * as requestUser from 'src/interfaces/request-user';
import {
  CreateEndpointPermissionRulesDTO,
  PatchEndpointPermissionRulesDTO,
} from 'src/interfaces/DTO/endpoint-permission-rules.dto';
import { EndpointPermissionRulesEntity } from 'src/entities/endpoint-permission-rules.entity';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { AssignPermissionDTO } from 'src/interfaces/DTO/assign.dto';
import { EndpointKey } from 'src/common/decorators/endpoint-key.decorator';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('Endpoint Permission Rules')
@Controller('endpoint-permission-rules')
export class EndpointPermissionRulesController {
  constructor(private readonly endpointPermissionRulesService: EndpointPermissionRulesService) {}

  @UseGuards(AuthGuard)
  @EndpointKey('endpoint-permission-rules.create')
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiCookieAuth('auth_token')
  @ApiOperation({ summary: 'Create a new endpoint permission rule' })
  @ApiCreatedResponse({ type: EndpointPermissionRulesEntity })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Post('new')
  create(
    @Body() dto: CreateEndpointPermissionRulesDTO,
    @Req() request: requestUser.RequestWithUser,
  ): Promise<EndpointPermissionRulesEntity> {
    return this.endpointPermissionRulesService.create(dto, request);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('endpoint-permission-rules.update')
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiCookieAuth('auth_token')
  @ApiOperation({ summary: 'Update an endpoint permission rule' })
  @ApiParam({ name: 'id', description: 'Endpoint permission rule UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiOkResponse({ type: EndpointPermissionRulesEntity })
  @ApiNotFoundResponse({ description: 'Endpoint permission rule not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Patch('edit/:id')
  edit(@Param('id') id: string, @Body() dto: PatchEndpointPermissionRulesDTO): Promise<EndpointPermissionRulesEntity> {
    return this.endpointPermissionRulesService.update(id, dto);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('endpoint-permission-rules.update')
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiCookieAuth('auth_token')
  @ApiOperation({ summary: 'Assign permissions to an endpoint permission rule' })
  @ApiParam({ name: 'id', description: 'Endpoint permission rule UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiOkResponse({ type: EndpointPermissionRulesEntity })
  @ApiNotFoundResponse({ description: 'Endpoint permission rule or permission not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Patch('assign-permissions/:id')
  assignPermissions(@Param('id') id: string, @Body() dto: AssignPermissionDTO): Promise<EndpointPermissionRulesEntity> {
    return this.endpointPermissionRulesService.assignPermissions(id, dto);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('endpoint-permission-rules.update')
  @ApiCookieAuth('auth_token')
  @ApiOperation({ summary: 'Enable an endpoint permission rule' })
  @ApiParam({ name: 'id', description: 'Endpoint permission rule UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiOkResponse({
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  @ApiNotFoundResponse({ description: 'Endpoint permission rule not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Patch('enable/:id')
  enableRule(@Param('id') id: string): Promise<{ message: string }> {
    return this.endpointPermissionRulesService.enableRule(id);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('endpoint-permission-rules.update')
  @ApiCookieAuth('auth_token')
  @ApiOperation({ summary: 'Disable an endpoint permission rule' })
  @ApiParam({ name: 'id', description: 'Endpoint permission rule UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiOkResponse({
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  @ApiNotFoundResponse({ description: 'Endpoint permission rule not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Patch('disable/:id')
  disableRule(@Param('id') id: string): Promise<{ message: string }> {
    return this.endpointPermissionRulesService.disableRule(id);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('endpoint-permission-rules.delete')
  @ApiCookieAuth('auth_token')
  @ApiOperation({ summary: 'Delete an endpoint permission rule' })
  @ApiParam({ name: 'id', description: 'Endpoint permission rule UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiOkResponse({
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  @ApiNotFoundResponse({ description: 'Endpoint permission rule not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Delete('delete/:id')
  delete(@Param('id') id: string): Promise<{ message: string }> {
    return this.endpointPermissionRulesService.delete(id);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('endpoint-permission-rules.find')
  @ApiCookieAuth('auth_token')
  @ApiOperation({ summary: 'List all endpoint permission rules' })
  @ApiOkResponse({ type: [EndpointPermissionRulesEntity] })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Get('all')
  findAll(): Promise<EndpointPermissionRulesEntity[]> {
    return this.endpointPermissionRulesService.findAll();
  }

  @UseGuards(AuthGuard)
  @EndpointKey('endpoint-permission-rules.find')
  @ApiCookieAuth('auth_token')
  @ApiOperation({ summary: 'Find an endpoint permission rule by ID' })
  @ApiParam({ name: 'id', description: 'Endpoint permission rule UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiOkResponse({ type: EndpointPermissionRulesEntity })
  @ApiNotFoundResponse({ description: 'Endpoint permission rule not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Get('find/:id')
  findOne(@Param('id') id: string): Promise<EndpointPermissionRulesEntity> {
    return this.endpointPermissionRulesService.findOne(id);
  }

  @UseGuards(ApiKeyGuard)
  @EndpointKey('endpoint-permission-rules.find_api')
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Get required permissions for an endpoint key',
    description: 'Used by other microservices to retrieve the permission codes required to access a given endpoint key.',
  })
  @ApiParam({ name: 'key', description: 'Endpoint key name', example: 'users.update' })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: { type: 'string' },
      nullable: true,
      example: ['USERS_CREATE', 'USERS_UPDATE'],
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid API key' })
  @ApiForbiddenResponse({ description: 'Insufficient API key permissions' })
  @Get('get-endpoint-permissions/:key')
  getEndpointPermissions(@Param('key') key: string): Promise<string[] | null> {
    return this.endpointPermissionRulesService.getPermissionsForEndpoint(key);
  }
}

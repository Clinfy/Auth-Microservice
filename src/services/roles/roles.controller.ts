import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RolesService } from 'src/services/roles/roles.service';
import { AuthGuard } from 'src/common/guards/auth.guard';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { RoleEntity } from 'src/entities/role.entity';
import { AssignPermissionDTO } from 'src/interfaces/DTO/assign.dto';
import { PatchRoleDTO } from 'src/interfaces/DTO/patch.dto';
import * as requestUser from 'src/interfaces/request-user';
import { CreateRoleDTO } from 'src/interfaces/DTO/create.dto';
import { EndpointKey } from 'src/common/decorators/endpoint-key.decorator';
import { PaginatedResponseDto, PaginationQueryDto } from 'src/interfaces/DTO/pagination.dto';
import { IRole } from 'src/interfaces/role.interface';

@ApiTags('Roles')
@ApiCookieAuth('auth_token')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @UseGuards(AuthGuard)
  @EndpointKey('roles.create')
  @ApiOperation({ summary: 'Create a new role' })
  @ApiCreatedResponse({ type: RoleEntity })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Post('new')
  create(@Req() request: requestUser.RequestWithUser, @Body() dto: CreateRoleDTO): Promise<RoleEntity> {
    return this.rolesService.create(dto, request);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('roles.update')
  @ApiOperation({ summary: 'Update a role' })
  @ApiParam({ name: 'id', description: 'Role UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiOkResponse({ type: RoleEntity })
  @ApiNotFoundResponse({ description: 'Role not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Patch('edit/:id')
  edit(@Body() dto: PatchRoleDTO, @Param('id') id: string): Promise<RoleEntity> {
    return this.rolesService.update(id, dto);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('roles.update')
  @ApiOperation({ summary: 'Assign permissions to a role' })
  @ApiParam({ name: 'id', description: 'Role UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiOkResponse({ type: RoleEntity })
  @ApiNotFoundResponse({ description: 'Role or permission not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Patch('assign-permissions/:id')
  assignPermissions(@Param('id') id: string, @Body() dto: AssignPermissionDTO): Promise<RoleEntity> {
    return this.rolesService.assignPermissions(id, dto);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('roles.delete')
  @ApiOperation({ summary: 'Delete a role' })
  @ApiParam({ name: 'id', description: 'Role UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiOkResponse({
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  @ApiNotFoundResponse({ description: 'Role not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Delete('delete/:id')
  delete(@Param('id') id: string): Promise<{ message: string }> {
    return this.rolesService.delete(id);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('roles.details')
  @ApiOperation({ summary: 'Get id and name of each role registered in the system' })
  @ApiOkResponse({ type: 'object' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Get('details')
  getDetails(): Promise<IRole[]> {
    return this.rolesService.getUnrestrictedDetails();
  }

  @UseGuards(AuthGuard)
  @EndpointKey('roles.find')
  @ApiOperation({ summary: 'Find a role by ID' })
  @ApiParam({ name: 'id', description: 'Role UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiOkResponse({ type: RoleEntity })
  @ApiNotFoundResponse({ description: 'Role not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Get('find/:id')
  findOne(@Param('id') id: string): Promise<RoleEntity> {
    return this.rolesService.findOne(id);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('roles.find')
  @ApiOperation({ summary: 'Find all roles' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiExtraModels(RoleEntity)
  @ApiOkResponse({
    description: 'Paginated list of roles',
    schema: {
      properties: {
        data: { type: 'array', items: { $ref: getSchemaPath(RoleEntity) } },
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
  findAll(@Query() query: PaginationQueryDto): Promise<PaginatedResponseDto<RoleEntity>> {
    return this.rolesService.findAll(query);
  }
}

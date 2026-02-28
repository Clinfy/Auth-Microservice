import {Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards} from '@nestjs/common';
import {RolesService} from "src/services/roles/roles.service";
import {AuthGuard} from "src/middlewares/auth.middleware";
import {Permissions} from "src/middlewares/decorators/permissions.decorator";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {RoleEntity} from "src/entities/role.entity";
import {AssignPermissionDTO} from "src/interfaces/DTO/assign.dto";
import {PatchRoleDTO} from "src/interfaces/DTO/patch.dto";
import * as requestUser from 'src/interfaces/request-user';

@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @UseGuards(AuthGuard)
  @Permissions(['ROLES_CREATE'])
  @ApiOperation({ summary: 'Create a new role' })
  @ApiCreatedResponse({ type: RoleEntity })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Post('new')
  create(@Req() request: requestUser.RequestWithUser, @Body() dto: any): Promise<RoleEntity> {
    return this.rolesService.create(dto, request);
  }

  @UseGuards(AuthGuard)
  @Permissions(['ROLES_UPDATE'])
  @ApiOperation({ summary: 'Update a role' })
  @ApiOkResponse({ type: RoleEntity })
  @ApiNotFoundResponse({ description: 'Role not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Patch('edit/:id')
  edit(@Body() dto: PatchRoleDTO, @Param('id') id: string): Promise<RoleEntity> {
    return this.rolesService.update(id, dto);
  }

  @UseGuards(AuthGuard)
  @Permissions(['ROLES_UPDATE'])
  @ApiOperation({ summary: 'Assign permissions to a role' })
  @ApiOkResponse({ type: RoleEntity })
  @ApiNotFoundResponse({ description: 'Role or permission not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Patch('assign-permissions/:id')
  assignPermissions(@Param('id') id: string, @Body() dto: AssignPermissionDTO): Promise<RoleEntity> {
    return this.rolesService.assignPermissions(id, dto);
  }

  @UseGuards(AuthGuard)
  @Permissions(['ROLES_DELETE'])
  @ApiOperation({ summary: 'Delete a role' })
  @ApiOkResponse({ schema: { type: 'object', properties: { message: { type: 'string' } } } })
  @ApiNotFoundResponse({ description: 'Role not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Delete('delete/:id')
  delete(@Param('id') id: string): Promise<{ message: string }> {
    return this.rolesService.delete(id);
  }

  @UseGuards(AuthGuard)
  @Permissions(['ROLES_READ'])
  @ApiOperation({ summary: 'Find a role by id number' })
  @ApiOkResponse({ type: RoleEntity })
  @ApiNotFoundResponse({ description: 'Role not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Get('find/:id')
  findOne(@Param('id') id: string): Promise<RoleEntity> {
    return this.rolesService.findOne(id);
  }

  @UseGuards(AuthGuard)
  @Permissions(['ROLES_READ'])
  @ApiOperation({ summary: 'Find all roles' })
  @ApiOkResponse({ type: [RoleEntity] })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Get('all')
  findAll(): Promise<RoleEntity[]> {
    return this.rolesService.findAll();
  }
}

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
import {PermissionsService} from "src/services/permissions/permissions.service";
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
import {PermissionEntity} from "src/entities/permission.entity";
import {CreatePermissionDTO} from "src/interfaces/DTO/create.dto";
import * as requestUser from 'src/interfaces/request-user';

@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionService: PermissionsService) {}

  @UseGuards(AuthGuard)
  @Permissions(['PERMISSIONS_CREATE'])
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiOperation({ summary: 'Create a new permission' })
  @ApiCreatedResponse({ type: PermissionEntity })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Post('new')
  create(@Req() request: requestUser.RequestWithUser, @Body() dto: CreatePermissionDTO): Promise<PermissionEntity> {
    return this.permissionService.create(dto, request);
  }

  @UseGuards(AuthGuard)
  @Permissions(['PERMISSIONS_UPDATE'])
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiOperation({ summary: 'Update a permission' })
  @ApiOkResponse({ type: PermissionEntity })
  @ApiNotFoundResponse({ description: 'Permission not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Patch('edit/:id')
  edit(@Body() dto: CreatePermissionDTO, @Param('id') id: string): Promise<PermissionEntity> {
    return this.permissionService.update(id, dto);
  }

  @UseGuards(AuthGuard)
  @Permissions(['PERMISSIONS_DELETE'])
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiOperation({ summary: 'Delete a permission' })
  @ApiOkResponse({ schema: { type: 'object', properties: { message: { type: 'string' } } } })
  @ApiNotFoundResponse({ description: 'Permission not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Delete('delete/:id')
  delete(@Param('id') id: string): Promise<{ message: string }> {
    return this.permissionService.delete(id);
  }

  @UseGuards(AuthGuard)
  @Permissions(['PERMISSIONS_READ'])
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiOperation({ summary: 'Find a permission by id number' })
  @ApiOkResponse({ type: PermissionEntity })
  @ApiNotFoundResponse({ description: 'Permission not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Get('find/:id')
  findOne(@Param('id') id: string): Promise<PermissionEntity> {
    return this.permissionService.findOne(id);
  }

  @UseGuards(AuthGuard)
  @Permissions(['PERMISSIONS_READ'])
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiOperation({ summary: 'Find all permissions' })
  @ApiOkResponse({ type: [PermissionEntity] })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Get('all')
  findAll(): Promise<PermissionEntity[]> {
    return this.permissionService.findAll();
  }
}

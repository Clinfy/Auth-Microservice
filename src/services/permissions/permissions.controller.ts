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
import { PermissionsService } from 'src/services/permissions/permissions.service';
import { AuthGuard } from 'src/common/guards/auth.guard';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PermissionEntity } from 'src/entities/permission.entity';
import { CreatePermissionDTO } from 'src/interfaces/DTO/create.dto';
import * as requestUser from 'src/interfaces/request-user';
import { EndpointKey } from 'src/common/decorators/endpoint-key.decorator';

@ApiTags('Permissions')
@ApiCookieAuth('auth_token')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionService: PermissionsService) {}

  @UseGuards(AuthGuard)
  @EndpointKey('permission.create')
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiOperation({ summary: 'Create a new permission' })
  @ApiCreatedResponse({ type: PermissionEntity })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Post('new')
  create(@Req() request: requestUser.RequestWithUser, @Body() dto: CreatePermissionDTO): Promise<PermissionEntity> {
    return this.permissionService.create(dto, request);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('permission.update')
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiOperation({ summary: 'Update a permission' })
  @ApiParam({ name: 'id', description: 'Permission UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiOkResponse({ type: PermissionEntity })
  @ApiNotFoundResponse({ description: 'Permission not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Patch('edit/:id')
  edit(@Body() dto: CreatePermissionDTO, @Param('id') id: string): Promise<PermissionEntity> {
    return this.permissionService.update(id, dto);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('permission.delete')
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiOperation({ summary: 'Delete a permission' })
  @ApiParam({ name: 'id', description: 'Permission UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiOkResponse({
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  @ApiNotFoundResponse({ description: 'Permission not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Delete('delete/:id')
  delete(@Param('id') id: string): Promise<{ message: string }> {
    return this.permissionService.delete(id);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('permission.find')
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiOperation({ summary: 'Find a permission by ID' })
  @ApiParam({ name: 'id', description: 'Permission UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiOkResponse({ type: PermissionEntity })
  @ApiNotFoundResponse({ description: 'Permission not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Get('find/:id')
  findOne(@Param('id') id: string): Promise<PermissionEntity> {
    return this.permissionService.findOne(id);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('permission.find')
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiOperation({ summary: 'Find all permissions' })
  @ApiOkResponse({ type: [PermissionEntity] })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Get('all')
  findAll(): Promise<PermissionEntity[]> {
    return this.permissionService.findAll();
  }
}

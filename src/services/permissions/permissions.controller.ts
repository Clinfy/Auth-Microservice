import {Body, Controller, Delete, Get, Param, Patch, Post, UseGuards} from '@nestjs/common';
import {PermissionsService} from "src/services/permissions/permissions.service";
import {AuthGuard} from "src/middlewares/auth.middleware";
import {Permissions} from "src/middlewares/decorators/permissions.decorator";
import {ApiBearerAuth, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation} from "@nestjs/swagger";
import {PermissionEntity} from "src/entities/permission.entity";
import {CreatePermissionDTO} from "src/interfaces/DTO/create.dto";

@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
    constructor(private readonly permissionService: PermissionsService) {}

    @UseGuards(AuthGuard)
    @Permissions(['PERMISSIONS_CREATE'])
    @ApiOperation({summary: 'Create a new permission'})
    @ApiCreatedResponse({type: PermissionEntity})
    @Post('new')
    create(@Body() dto: CreatePermissionDTO): Promise<PermissionEntity> {
        return this.permissionService.create(dto);
    }

    @UseGuards(AuthGuard)
    @Permissions(['PERMISSIONS_UPDATE'])
    @ApiOperation({summary: 'Update a permission'})
    @ApiOkResponse({type: PermissionEntity})
    @ApiNotFoundResponse({description: 'Permission not found'})
    @Patch('edit/:id')
    edit(@Body() dto: CreatePermissionDTO, @Param('id') id: number): Promise<PermissionEntity> {
        return this.permissionService.update(id, dto);
    }

    @UseGuards(AuthGuard)
    @Permissions(['PERMISSIONS_DELETE'])
    @ApiOperation({summary: 'Delete a permission'})
    @ApiOkResponse({description: 'Permission deleted'})
    @ApiNotFoundResponse({description: 'Permission not found'})
    @Delete('delete/:id')
    delete(@Param('id') id: number): Promise<{message: string}> {
        return this.permissionService.delete(id);
    }

    @UseGuards(AuthGuard)
    @Permissions(['PERMISSIONS_READ'])
    @ApiOperation({summary: 'Find a permission by id number'})
    @ApiOkResponse({type: PermissionEntity})
    @ApiNotFoundResponse({description: 'Permission not found'})
    @Get('find/:id')
    findOne(@Param('id') id: number): Promise<PermissionEntity> {
        return this.permissionService.findOne(id);
    }

    @UseGuards(AuthGuard)
    @Permissions(['PERMISSIONS_READ'])
    @ApiOperation({summary: 'Find all permissions'})
    @ApiOkResponse({type: [PermissionEntity]})
    @Get('all')
    findAll(): Promise<PermissionEntity[]> {
        return this.permissionService.findAll();
    }
}

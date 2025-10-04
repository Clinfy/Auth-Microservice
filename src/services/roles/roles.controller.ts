import {Body, Controller, Delete, Get, Param, Patch, Post, UseGuards} from '@nestjs/common';
import {RolesService} from "src/services/roles/roles.service";
import {AuthGuard} from "src/middlewares/auth.middleware";
import {Permissions} from "src/middlewares/decorators/permissions.decorator";
import {ApiBearerAuth, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation} from "@nestjs/swagger";
import {RoleEntity} from "src/entities/role.entity";
import {AssignPermissionDTO} from "src/interfaces/DTO/assign.dto";
import {PatchRoleDTO} from "src/interfaces/DTO/patch.dto";

@ApiBearerAuth()
@Controller('roles')
export class RolesController {
    constructor(private readonly rolesService: RolesService) {}

    @UseGuards(AuthGuard)
    @Permissions(['ROLES_CREATE'])
    @ApiOperation({summary: 'Create a new role'})
    @ApiCreatedResponse({type: RoleEntity})
    @Post('new')
    create(@Body() dto: any): Promise<RoleEntity> {
        return this.rolesService.create(dto);
    }

    @UseGuards(AuthGuard)
    @Permissions(['ROLES_UPDATE'])
    @ApiOperation({summary: 'Update a role'})
    @ApiOkResponse({type: RoleEntity})
    @ApiNotFoundResponse({description: 'Role not found'})
    @Patch('edit/:id')
    edit(@Body() dto: PatchRoleDTO, @Param('id') id: number): Promise<RoleEntity> {
        return this.rolesService.update(id, dto);
    }

    @UseGuards(AuthGuard)
    @Permissions(['ROLES_UPDATE'])
    @ApiOperation({summary: 'Assign permissions to a role'})
    @ApiOkResponse({type: RoleEntity})
    @ApiNotFoundResponse({description: 'Role not found'})
    @ApiNotFoundResponse({description: 'Permission not found'})
    @Patch('assign-permissions/:id')
    assignPermissions(@Param('id') id: number, @Body() dto: AssignPermissionDTO): Promise<RoleEntity> {
        return this.rolesService.assignPermissions(id, dto);
    }

    @UseGuards(AuthGuard)
    @Permissions(['ROLES_DELETE'])
    @ApiOperation({summary: 'Delete a role'})
    @ApiOkResponse({description: 'Role deleted'})
    @ApiNotFoundResponse({description: 'Role not found'})
    @Delete('delete/:id')
    delete(@Param('id') id: number): Promise<{message: string}> {
        return this.rolesService.delete(id);
    }

    @UseGuards(AuthGuard)
    @Permissions(['ROLES_READ'])
    @ApiOperation({summary: 'Find a role by id number'})
    @ApiOkResponse({type: RoleEntity})
    @ApiNotFoundResponse({description: 'Role not found'})
    @Get('find/:id')
    findOne(@Param('id') id: number): Promise<RoleEntity> {
        return this.rolesService.findOne(id);
    }

    @UseGuards(AuthGuard)
    @Permissions(['ROLES_READ'])
    @ApiOperation({summary: 'Find all roles'})
    @ApiOkResponse({type: [RoleEntity]})
    @Get('all')
    findAll(): Promise<RoleEntity[]> {
        return this.rolesService.findAll();
    }
}

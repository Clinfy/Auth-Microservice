import {Body, Controller, Get, Param, Post, Req, UseGuards} from '@nestjs/common';
import {AuthGuard} from "src/middlewares/auth.middleware";
import {Permissions} from "src/middlewares/decorators/permissions.decorator";
import {ApiBearerAuth, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation} from "@nestjs/swagger";
import * as requestUser from "src/interfaces/request-user";
import {UsersService} from "src/services/users/users.service";
import {UserEntity} from "src/entities/user.entity";
import {RegisterUserDTO} from "src/interfaces/DTO/register.dto";
import {LoginDTO} from "src/interfaces/DTO/login.dto";
import {AssignRoleDTO} from "src/interfaces/DTO/assign.dto";
import {AuthInterface} from "src/interfaces/auth.interface";

@Controller('users')
export class UsersController {
    constructor(private readonly userService: UsersService) {}

    @UseGuards(AuthGuard)
    @Permissions(['USERS_CREATE'])
    @ApiOperation({summary: 'Create a new user'})
    @ApiBearerAuth()
    @ApiCreatedResponse({type: UserEntity})
    @Post('register')
    register(@Body() dto: RegisterUserDTO): Promise<UserEntity> {
        return this.userService.register(dto);
    }

    @ApiOperation({summary: 'Log in a user'})
    @ApiOkResponse({schema: {type: 'object', properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' }}}})
    @Post('login')
    logIn(@Body() dto: LoginDTO): Promise<AuthInterface> {
        return this.userService.logIn(dto);
    }

    @ApiOperation({summary: 'Refresh a user token'})
    @ApiOkResponse({schema: {type: 'object', properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' }}}})
    @Get('refresh-token')
    refreshToken(@Req() request: Request): Promise<AuthInterface> {
        return this.userService.refreshToken(request.headers['refresh-token'] as string);
    }

    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiOperation({summary: 'Return if a user have permissions to do something'})
    @ApiOkResponse({type: Boolean})
    @Get('can-do')
    canDo(@Req() request: requestUser.RequestWithUser, @Param('permission') permission: string ): Promise<Boolean> {
        return this.userService.canDo(request.user, permission);
    }

    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiOperation({summary: 'Return the email of the user logged in'})
    @ApiOkResponse({schema: {type: 'object', properties: { email: { type: 'string' }}}})
    @Get('me')
    me(@Req() request: requestUser.RequestWithUser): Promise<string> {
        return Promise.resolve(request.user.email);
    }

    @UseGuards(AuthGuard)
    @Permissions(['USERS_UPDATE'])
    @ApiBearerAuth()
    @ApiOperation({summary: 'Assign roles to a user'})
    @ApiOkResponse({type: UserEntity})
    @ApiNotFoundResponse({description: 'User not found'})
    @ApiNotFoundResponse({description: 'Role not found'})
    @Post('assign-role/:id')
    assignRole(@Param('id') id: number, @Body() dto: AssignRoleDTO): Promise<UserEntity> {
        return this.userService.assignRole(id, dto);
    }
}

import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {AuthGuard} from "src/middlewares/auth.middleware";
import {Permissions} from "src/middlewares/decorators/permissions.decorator";
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import * as requestUser from "src/interfaces/request-user";
import {UsersService} from "src/services/users/users.service";
import {UserEntity} from "src/entities/user.entity";
import {RegisterUserDTO} from "src/interfaces/DTO/register.dto";
import {LoginDTO} from "src/interfaces/DTO/login.dto";
import {AssignRoleDTO} from "src/interfaces/DTO/assign.dto";
import {AuthInterface} from "src/interfaces/auth.interface";
import { ApiKeyGuard } from 'src/middlewares/api-key.middleware';
import {
  ForgotPasswordDTO,
  ResetPasswordDTO,
} from 'src/interfaces/DTO/reset-password.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly userService: UsersService) {}

  @UseGuards(ApiKeyGuard)
  @Permissions(['USERS_CREATE'])
  @ApiHeader({ name: 'x-api-key', required: true })
  @ApiOperation({ summary: 'Create a new user' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid API key' })
  @ApiForbiddenResponse({ description: 'Insufficient API key permissions' })
  @ApiCreatedResponse({ schema: { type: 'object', properties: { message: { type: 'string' } } }, })
  @Post('register')
  register(@Req() request: requestUser.RequestWithUser, @Body() dto: RegisterUserDTO): Promise<{ message: string }> {
    return this.userService.register(dto, request);
  }

  @ApiOperation({ summary: 'Log in a user' })
  @ApiOkResponse({ schema: { type: 'object', properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' }, }, }, })
  @ApiUnauthorizedResponse({ description: 'Wrong email or password' })
  @Post('login')
  logIn(@Body() dto: LoginDTO): Promise<AuthInterface> {
    return this.userService.logIn(dto);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log out a user' })
  @ApiOkResponse({ schema: { type: 'object', properties: { message: { type: 'string' } } }, })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @Post('logout')
  logOut(@Req() request: requestUser.RequestWithUser): Promise<{ message: string }> {
    return this.userService.logOut(request.user);
  }

  @ApiOperation({ summary: 'Refresh a user token' })
  @ApiHeader({ name: 'refresh-token', required: true })
  @ApiOkResponse({ schema: { type: 'object', properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' }, }, }, })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh token' })
  @Get('refresh-token')
  refreshToken(@Req() request: Request): Promise<AuthInterface> {
    return this.userService.refreshToken(
      request.headers['refresh-token'] as string,
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return if a user have permissions to do something', })
  @ApiOkResponse({ schema: { type: 'boolean' } })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Get('can-do/:permission')
  canDo(@Req() request: requestUser.RequestWithUser, @Param('permission') permission: string): Promise<boolean> {
    return this.userService.canDo(request.user, permission);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the email of the user logged in' })
  @ApiOkResponse({ schema: { type: 'object', properties: { email: { type: 'string' } } }, })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @Get('me')
  me(@Req() request: requestUser.RequestWithUser): {id: string, email: string, person_id: string} {
    return {
      id: request.user.id,
      email: request.user.email,
      person_id: request.user.person_id
    };
  }

  @UseGuards(AuthGuard)
  @Permissions(['USERS_UPDATE'])
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign roles to a user' })
  @ApiOkResponse({ type: UserEntity })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'User or role not found' })
  @Post('assign-role/:id')
  assignRole(@Param('id') id: string, @Body() dto: AssignRoleDTO): Promise<UserEntity> {
    return this.userService.assignRole(id, dto);
  }

  @ApiOperation({ summary: 'Send an email to reset the password of a user' })
  @ApiOkResponse({ schema: { type: 'object', properties: { message: { type: 'string' } } }, })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDTO): Promise<{ message: string }> {
    return this.userService.forgotPassword(dto);
  }

  @ApiOperation({ summary: 'Reset the password of a user' })
  @ApiQuery({ name: 'token', description: "The token sent to the user's email", })
  @ApiOkResponse({ schema: { type: 'object', properties: { message: { type: 'string' } } }, })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Password already changed' })
  @Post('reset-password')
  resetPassword(@Query('token') token: string, @Body() dto: ResetPasswordDTO): Promise<{ message: string }> {
    return this.userService.resetPassword(token, dto);
  }

  @UseGuards(AuthGuard)
  @Permissions(['USERS_READ_ALL'])
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Find all users' })
  @ApiOkResponse({ type: [UserEntity] })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Get('all')
  findAll(): Promise<UserEntity[]> {
    return this.userService.findAll();
  }
}

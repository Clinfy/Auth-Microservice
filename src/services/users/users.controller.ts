import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from 'src/middlewares/auth.middleware';
import { MicroserviceGuard } from 'src/middlewares/microservice.middleware';
import { Permissions } from 'src/middlewares/decorators/permissions.decorator';
import type { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import * as requestUser from 'src/interfaces/request-user';
import { UsersService } from 'src/services/users/users.service';
import { UserEntity } from 'src/entities/user.entity';
import { RegisterUserDTO } from 'src/interfaces/DTO/register.dto';
import { LoginDTO } from 'src/interfaces/DTO/login.dto';
import { AssignRoleDTO } from 'src/interfaces/DTO/assign.dto';
import { ApiKeyGuard } from 'src/middlewares/api-key.middleware';
import { ForgotPasswordDTO, ResetPasswordDTO } from 'src/interfaces/DTO/reset-password.dto';
import { ActivateUserDTO } from 'src/interfaces/DTO/activate.dto';
import { getAuthCookieOptions, getRefreshCookieOptions } from 'src/common/tools/cookie-options';
import { UsersErrorCodes, UsersException } from 'src/services/users/users.exception.handler';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly userService: UsersService) {}

  @UseGuards(ApiKeyGuard)
  @Permissions(['USERS_CREATE'])
  @ApiHeader({ name: 'x-api-key', required: true })
  @ApiOperation({ summary: 'Create a new user' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid API key' })
  @ApiForbiddenResponse({ description: 'Insufficient API key permissions' })
  @ApiCreatedResponse({
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  @Post('register')
  register(@Req() request: requestUser.RequestWithUser, @Body() dto: RegisterUserDTO): Promise<{ message: string }> {
    return this.userService.register(dto, request);
  }

  @ApiOperation({ summary: 'Activate a user for the first time' })
  @ApiOkResponse({
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  @Post('first-activation')
  firstActivation(@Body() dto: ActivateUserDTO): Promise<{ message: string }> {
    return this.userService.firstActivation(dto);
  }

  @UseGuards(AuthGuard)
  @Permissions(['USERS_UPDATE'])
  @ApiCookieAuth('auth_token')
  @ApiOperation({ summary: 'Activate a user' })
  @ApiOkResponse({
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @Post('activate/:id')
  activate(@Param('id') id: string): Promise<{ message: string }> {
    return this.userService.activate(id);
  }

  @UseGuards(AuthGuard)
  @Permissions(['USERS_UPDATE'])
  @ApiCookieAuth('auth_token')
  @ApiOperation({ summary: 'Deactivate a user' })
  @ApiOkResponse({
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @Post('deactivate/:id')
  deactivate(@Param('id') id: string): Promise<{ message: string }> {
    return this.userService.deactivate(id);
  }

  @ApiOperation({ summary: 'Log in a user' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Wrong email or password' })
  @Post('login')
  async logIn(
    @Body() dto: LoginDTO,
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    const tokens = await this.userService.logIn(dto, req);
    response.cookie('auth_token', tokens.accessToken, getAuthCookieOptions());
    response.cookie('refresh_token', tokens.refreshToken, getRefreshCookieOptions());
    return { message: 'Login successful' };
  }

  @UseGuards(AuthGuard)
  @ApiCookieAuth('auth_token')
  @ApiOperation({ summary: 'Log out a user' })
  @ApiOkResponse({
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @Post('logout')
  async logOut(
    @Req() request: requestUser.RequestWithUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    const result = await this.userService.logOut(request.user);
    response.clearCookie('auth_token', { path: '/' });
    response.clearCookie('refresh_token', { path: '/users/refresh-token' });
    return result;
  }

  @ApiOperation({ summary: 'Refresh a user token' })
  @ApiCookieAuth('auth_token')
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh token' })
  @Get('refresh-token')
  async refreshToken(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<{ message: string }> {
    const refreshToken = request.cookies?.['refresh_token'];
    if (!refreshToken) {
      throw new UsersException(
        'Refresh token cookie missing',
        UsersErrorCodes.REFRESH_TOKEN_MISSING,
        HttpStatus.UNAUTHORIZED,
      );
    }
    const tokens = await this.userService.refreshToken(refreshToken);
    response.cookie('auth_token', tokens.accessToken, getAuthCookieOptions());
    response.cookie('refresh_token', tokens.refreshToken, getRefreshCookieOptions());
    return { message: 'Token refreshed' };
  }

  @UseGuards(MicroserviceGuard)
  @ApiSecurity('api-key')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Return if a user have permissions to do something',
  })
  @ApiOkResponse({ schema: { type: 'boolean' } })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid API key or bearer token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Get('can-do/:permission')
  canDo(@Req() request: requestUser.RequestWithUser, @Param('permission') permission: string): Promise<boolean> {
    return this.userService.canDo(request.user, permission);
  }

  @UseGuards(MicroserviceGuard)
  @ApiSecurity('api-key')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the authenticated user info' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        person_id: { type: 'string' },
        session_id: { type: 'string' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid API key or bearer token' })
  @Get('me')
  me(@Req() request: requestUser.RequestWithUser): {
    id: string;
    email: string;
    person_id: string;
    session_id: string;
  } {
    return {
      id: request.user.id,
      email: request.user.email,
      person_id: request.user.person_id,
      session_id: request.user.session_id,
    };
  }

  @UseGuards(AuthGuard)
  @Permissions(['USERS_UPDATE'])
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiCookieAuth('auth_token')
  @ApiOperation({ summary: 'Assign roles to a user' })
  @ApiOkResponse({ type: UserEntity })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'User or role not found' })
  @Post('assign-role/:id')
  assignRole(@Param('id') id: string, @Body() dto: AssignRoleDTO): Promise<UserEntity> {
    return this.userService.assignRole(id, dto);
  }

  @ApiOperation({ summary: 'Send an email to reset the password of a user' })
  @ApiOkResponse({
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDTO): Promise<{ message: string }> {
    return this.userService.forgotPassword(dto);
  }

  @ApiOperation({ summary: 'Reset the password of a user' })
  @ApiQuery({
    name: 'token',
    description: "The token sent to the user's email",
  })
  @ApiOkResponse({
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Password already changed' })
  @Post('reset-password')
  resetPassword(@Query('token') token: string, @Body() dto: ResetPasswordDTO): Promise<{ message: string }> {
    return this.userService.resetPassword(token, dto);
  }

  @UseGuards(AuthGuard)
  @Permissions(['USERS_READ_ALL'])
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiCookieAuth('auth_token')
  @ApiOperation({ summary: 'Find all users' })
  @ApiOkResponse({ type: [UserEntity] })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth cookie' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Get('all')
  findAll(): Promise<UserEntity[]> {
    return this.userService.findAll();
  }
}

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
import { AuthGuard } from 'src/common/guards/auth.guard';
import { MicroserviceGuard } from 'src/common/guards/microservice.guard';
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
  ApiParam,
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
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import { ForgotPasswordDTO, ResetPasswordDTO } from 'src/interfaces/DTO/reset-password.dto';
import { ActivateUserDTO } from 'src/interfaces/DTO/activate.dto';
import { getAuthCookieOptions, getRefreshCookieOptions } from 'src/common/utils/cookie-options.util';
import { UsersErrorCodes, UsersException } from 'src/services/users/users.exception';
import { EndpointKey } from 'src/common/decorators/endpoint-key.decorator';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly userService: UsersService) {}

  @UseGuards(ApiKeyGuard)
  @EndpointKey('users.register')
  @ApiSecurity('api-key')
  @ApiHeader({ name: 'x-api-key', required: true, description: 'API key for machine-to-machine authentication' })
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

  @ApiOperation({
    summary: 'Activate a user for the first time',
    description:
      'Sets a new password and activates the user on their first login using the temporary password sent by email.',
  })
  @ApiOkResponse({
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  @ApiUnauthorizedResponse({ description: 'Wrong email or temporary password' })
  @Post('first-activation')
  firstActivation(@Body() dto: ActivateUserDTO): Promise<{ message: string }> {
    return this.userService.firstActivation(dto);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('users.update')
  @ApiCookieAuth('auth_token')
  @ApiOperation({ summary: 'Activate a user' })
  @ApiParam({ name: 'id', description: 'User UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
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
  @EndpointKey('users.update')
  @ApiCookieAuth('auth_token')
  @ApiOperation({ summary: 'Deactivate a user' })
  @ApiParam({ name: 'id', description: 'User UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
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

  @ApiOperation({
    summary: 'Refresh a user token',
    description: 'Uses the HttpOnly refresh_token cookie to issue a new auth_token and refresh_token pair.',
  })
  @ApiCookieAuth('refresh_token')
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid refresh_token cookie' })
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
  @EndpointKey('users.find_api')
  @ApiSecurity('api-key')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Return if a user has permissions to do something',
    description: 'Used by other microservices. Requires both a valid X-API-Key header and a Bearer token.',
  })
  @ApiParam({ name: 'permission', description: 'Permission code to check', example: 'USERS_CREATE' })
  @ApiOkResponse({ schema: { type: 'boolean' } })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid API key or bearer token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Get('can-do/:permission')
  canDo(@Req() request: requestUser.RequestWithUser, @Param('permission') permission: string): Promise<boolean> {
    return this.userService.canDo(request.user, permission);
  }

  @UseGuards(MicroserviceGuard)
  @EndpointKey('users.find_api')
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
  @EndpointKey('users.update')
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiCookieAuth('auth_token')
  @ApiOperation({ summary: 'Assign roles to a user' })
  @ApiParam({ name: 'id', description: 'User UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
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
  @EndpointKey('users.find')
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

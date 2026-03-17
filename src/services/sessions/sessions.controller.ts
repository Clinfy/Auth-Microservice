import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SessionsService } from 'src/services/sessions/sessions.service';
import { SessionWithSid } from 'src/interfaces/session.interface';
import { AuthGuard } from 'src/middlewares/auth.middleware';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { EndpointKey } from 'src/middlewares/decorators/endpoint-key.decorator';

@ApiTags('Sessions')
@ApiCookieAuth('auth_token')
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @UseGuards(AuthGuard)
  @EndpointKey('sessions.find')
  @ApiOperation({ summary: 'Get all active sessions for a user' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { sessions: { type: 'array' }, total: { type: 'number' } },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid auth cookie or session',
  })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Get('user/:userId')
  getUserSessions(@Param('userId') userId: string): Promise<{ sessions: SessionWithSid[]; total: number }> {
    return this.sessionsService.findUserSessions(userId);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('sessions.deactivate')
  @ApiOperation({ summary: 'Deactivate a session' })
  @ApiOkResponse({
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid auth cookie or session',
  })
  @ApiNotFoundResponse({ description: 'Session not found' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Post('deactivate/:sid')
  deactivateSession(@Param('sid') sid: string): Promise<{ message: string }> {
    return this.sessionsService.deactivateSession(sid);
  }
}

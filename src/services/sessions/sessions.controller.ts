import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SessionsService } from 'src/services/sessions/sessions.service';
import { SessionWithSid } from 'src/interfaces/session.interface';
import { AuthGuard } from 'src/common/guards/auth.guard';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { EndpointKey } from 'src/common/decorators/endpoint-key.decorator';

@ApiTags('Sessions')
@ApiCookieAuth('auth_token')
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @UseGuards(AuthGuard)
  @EndpointKey('sessions.find')
  @ApiOperation({ summary: 'Get all active sessions for a user' })
  @ApiParam({ name: 'userId', description: 'User UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        sessions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sid: { type: 'string', description: 'Session ID' },
              user_id: { type: 'string' },
              person_id: { type: 'string' },
              email: { type: 'string' },
              ip: { type: 'string' },
              userAgent: { type: 'string' },
              device: { type: 'string' },
              active: { type: 'boolean' },
              created_at: { type: 'string', format: 'date-time' },
              last_refresh_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        total: { type: 'number' },
      },
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
  @ApiParam({ name: 'sid', description: 'Session ID (Redis key suffix)', example: 'abc123def456' })
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

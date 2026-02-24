import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SessionsService } from 'src/services/sessions/sessions.service';
import { SessionWithSid } from 'src/interfaces/session.interface';
import { AuthGuard } from 'src/middlewares/auth.middleware';
import { Permissions } from 'src/middlewares/decorators/permissions.decorator';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiBearerAuth()
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @UseGuards(AuthGuard)
  @Permissions(['SESSIONS_READ'])
  @ApiOperation({ summary: 'Get all active sessions for a user' })
  @ApiOkResponse({ schema: { type: 'object', properties: { sessions: { type: 'array' }, total: { type: 'number' } }, }, })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token or session', })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Get('user/:userId')
  getUserSessions(@Param('userId') userId: string,): Promise<{ sessions: SessionWithSid[]; total: number }> {
    return this.sessionsService.findUserSessions(userId);
  }

  @UseGuards(AuthGuard)
  @Permissions(['SESSIONS_DEACTIVATE'])
  @ApiOperation({ summary: 'Deactivate a session' })
  @ApiOkResponse({ schema: { type: 'object', properties: { message: { type: 'string' } } } })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token or session', })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Post('deactivate/:sid')
  deactivateSession(@Param('sid') sid: string): Promise<{ message: string }> {
    return this.sessionsService.deactivateSession(sid);
  }
}
import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SessionsService } from 'src/services/sessions/sessions.service';
import { SessionWithSid } from 'src/interfaces/session.interface';
import { AuthGuard } from 'src/middlewares/auth.middleware';
import { Permissions } from 'src/middlewares/decorators/permissions.decorator';
import { ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth()
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @UseGuards(AuthGuard)
  @Get('user/:userId')
  @Permissions(['SESSIONS_READ'])
  getUserSessions(@Param('userId') userId: string): Promise<{sessions: SessionWithSid[], total: number}> {
    return this.sessionsService.findUserSessions(userId);
  }

  @UseGuards(AuthGuard)
  @Permissions(['SESSIONS_DEACTIVATE'])
  @Post('deactivate/:sid')
  deactivateSession(@Param('sid') sid: string): Promise<{message: string}> {
    return this.sessionsService.deactivateSession(sid);
  }


}
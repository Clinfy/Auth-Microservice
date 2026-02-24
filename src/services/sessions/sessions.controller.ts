import { Controller, Get, Param } from '@nestjs/common';
import { SessionsService } from 'src/services/sessions/sessions.service';
import { SessionWithSid } from 'src/interfaces/session.interface';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get('user/:userId')
  getUserSessions(@Param('userId') userId: string): Promise<{sessions: SessionWithSid[], total: number}> {
    return this.sessionsService.findUserSessions(userId);
  }
}
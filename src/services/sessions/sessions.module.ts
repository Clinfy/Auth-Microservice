import { Module } from '@nestjs/common';
import { JwtModule } from 'src/services/JWT/jwt.module';
import { SessionsController } from 'src/services/sessions/sessions.controller';
import { SessionsService } from 'src/services/sessions/sessions.service';

@Module({
  imports: [JwtModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService]
})

export class SessionsModule {}
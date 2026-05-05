import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/entities/user.entity';
import { JwtModule } from 'src/services/jwt/jwt.module';
import { SessionsController } from 'src/services/sessions/sessions.controller';
import { SessionsService } from 'src/services/sessions/sessions.service';
import { UsersRepository } from 'src/services/users/users.repository';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity]), JwtModule],
  controllers: [SessionsController],
  providers: [SessionsService, UsersRepository],
  exports: [SessionsService],
})
export class SessionsModule {}

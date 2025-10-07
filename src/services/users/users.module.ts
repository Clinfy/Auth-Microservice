import { Module } from '@nestjs/common';
import { UsersService } from 'src/services/users/users.service';
import { UsersController } from 'src/services/users/users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from 'src/clients/email/email.service';
import { UserEntity } from 'src/entities/user.entity';
import { JwtModule } from 'src/services/JWT/jwt.module';
import { IsUniqueEmailConstraint } from 'src/common/validators/unique-email.validator';
import { RolesModule } from 'src/services/roles/roles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    RolesModule,
    JwtModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, EmailService, IsUniqueEmailConstraint],
  exports: [UsersService]
})

export class UsersModule {}

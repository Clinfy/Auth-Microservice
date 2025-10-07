import { Module } from '@nestjs/common';
import { UsersService } from 'src/services/users/users.service';
import { UsersController } from 'src/services/users/users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/entities/user.entity';
import { JwtModule } from 'src/services/JWT/jwt.module';
import { IsUniqueEmailConstraint } from 'src/common/validators/unique-email.validator';
import { RolesModule } from 'src/services/roles/roles.module';
import { EmailModule } from 'src/clients/email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    RolesModule,
    JwtModule,
    EmailModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, IsUniqueEmailConstraint],
  exports: [UsersService]
})

export class UsersModule {}

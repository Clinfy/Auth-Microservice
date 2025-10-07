import { forwardRef, Module } from '@nestjs/common';
import { UsersService } from 'src/services/users/users.service';
import { UsersController } from 'src/services/users/users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesModule } from 'src/services/roles/roles.module';
import { EmailService } from 'src/clients/email/email.service';
import { ApiKeysModule } from 'src/services/api-keys/api-keys.module';
import { UserEntity } from 'src/entities/user.entity';
import { JwtModule } from 'src/services/JWT/jwt.module';
import { IsUniqueEmailConstraint } from 'src/common/validators/unique-email.validator';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    forwardRef(()=>RolesModule),
    forwardRef(()=>ApiKeysModule),
    forwardRef(()=>JwtModule)
  ],
  controllers: [UsersController],
  providers: [UsersService, EmailService, IsUniqueEmailConstraint],
  exports: [UsersService]
})

export class UsersModule {}
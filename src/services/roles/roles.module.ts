import { Module } from '@nestjs/common';
import { RolesService } from 'src/services/roles/roles.service';
import { RolesController } from 'src/services/roles/roles.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionsModule } from 'src/services/permissions/permissions.module';
import { RoleEntity } from 'src/entities/role.entity';
import { JwtModule } from 'src/services/jwt/jwt.module';
import { RolesRepository } from 'src/services/roles/roles.repository';
import { SessionsModule } from 'src/services/sessions/sessions.module';

@Module({
  imports: [TypeOrmModule.forFeature([RoleEntity]), PermissionsModule, JwtModule, SessionsModule],
  controllers: [RolesController],
  providers: [RolesService, RolesRepository],
  exports: [RolesService],
})
export class RolesModule {}

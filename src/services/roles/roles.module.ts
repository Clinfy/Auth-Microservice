import { Module } from '@nestjs/common';
import { RolesService } from 'src/services/roles/roles.service';
import { RolesController } from 'src/services/roles/roles.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionsModule } from 'src/services/permissions/permissions.module';
import { RoleEntity } from 'src/entities/role.entity';
import { JwtModule } from 'src/services/JWT/jwt.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RoleEntity]),
    PermissionsModule,
    JwtModule
  ],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService]
})
export class RolesModule {}

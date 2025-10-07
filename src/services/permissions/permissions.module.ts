import { Module } from '@nestjs/common';
import { PermissionsController } from 'src/services/permissions/permissions.controller';
import { PermissionsService } from 'src/services/permissions/permissions.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionEntity } from 'src/entities/permission.entity';
import { JwtModule } from 'src/services/JWT/jwt.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PermissionEntity]),
    JwtModule
  ],
  controllers: [PermissionsController],
  providers: [PermissionsService],
  exports: [PermissionsService]
})
export class PermissionsModule {}

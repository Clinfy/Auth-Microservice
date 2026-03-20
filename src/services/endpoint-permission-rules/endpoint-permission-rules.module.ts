import { Module } from '@nestjs/common';
import { EndpointPermissionRulesService } from './endpoint-permission-rules.service';
import { EndpointPermissionRulesController } from './endpoint-permission-rules.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EndpointPermissionRulesEntity } from 'src/entities/endpoint-permission-rules.entity';
import { PermissionsModule } from 'src/services/permissions/permissions.module';
import { EndpointPermissionRulesRepository } from 'src/services/endpoint-permission-rules/endpoint-permission-rules.repository';
import { JwtModule } from 'src/services/jwt/jwt.module';

@Module({
  imports: [TypeOrmModule.forFeature([EndpointPermissionRulesEntity]), PermissionsModule, JwtModule],
  providers: [EndpointPermissionRulesService, EndpointPermissionRulesRepository],
  controllers: [EndpointPermissionRulesController],
  exports: [EndpointPermissionRulesService],
})
export class EndpointPermissionRulesModule {}

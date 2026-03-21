import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeysController } from 'src/services/api-keys/api-keys.controller';
import { ApiKeysService } from 'src/services/api-keys/api-keys.service';
import { ApiKeysRepository } from 'src/services/api-keys/api-keys.repository';
import { PermissionsModule } from 'src/services/permissions/permissions.module';
import { ApiKeyEntity } from 'src/entities/api-key.entity';
import { JwtModule } from 'src/services/jwt/jwt.module';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKeyEntity]), PermissionsModule, JwtModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService, ApiKeysRepository],
  exports: [ApiKeysService, ApiKeysRepository],
})
export class ApiKeysModule {}

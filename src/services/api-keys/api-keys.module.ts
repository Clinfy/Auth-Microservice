import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeysController } from 'src/services/api-keys/api-keys.controller';
import { ApiKeysService } from 'src/services/api-keys/api-keys.service';
import { PermissionsModule } from 'src/services/permissions/permissions.module';
import { UsersModule } from 'src/services/users/users.module';
import { ApiKeyEntity } from 'src/entities/api-key.entity';
import { JwtModule } from 'src/services/JWT/jwt.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKeyEntity]),
    forwardRef(()=>PermissionsModule),
    forwardRef(()=>UsersModule),
    forwardRef(()=>JwtModule)
  ],
  controllers: [ApiKeysController],
  providers: [ApiKeysService],
  exports: [ApiKeysService]
})
export class ApiKeysModule {}
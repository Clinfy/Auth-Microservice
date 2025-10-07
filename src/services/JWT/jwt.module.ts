import { forwardRef, Module } from '@nestjs/common';
import { UsersModule } from 'src/services/users/users.module';
import { JwtService } from 'src/services/JWT/jwt.service';
import { AuthGuard } from 'src/middlewares/auth.middleware';
import { ApiKeyGuard } from 'src/middlewares/api-key.middleware';
import { ApiKeysModule } from 'src/services/api-keys/api-keys.module';
import { UsersService } from 'src/services/users/users.service';

@Module({
  imports: [
    forwardRef(()=>UsersModule),
    forwardRef(()=>ApiKeysModule)
  ],
  providers: [JwtService, AuthGuard, ApiKeyGuard],
  exports: [JwtService, AuthGuard, ApiKeyGuard]
})
export class JwtModule {}
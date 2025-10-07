import { Module } from '@nestjs/common';
import { JwtService } from 'src/services/JWT/jwt.service';
import { AuthGuard } from 'src/middlewares/auth.middleware';
import { ApiKeyGuard } from 'src/middlewares/api-key.middleware';

@Module({
  providers: [JwtService, AuthGuard, ApiKeyGuard],
  exports: [JwtService, AuthGuard, ApiKeyGuard],
})
export class JwtModule {}

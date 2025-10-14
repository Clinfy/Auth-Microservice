import { Module } from '@nestjs/common';
import { JwtService } from 'src/services/JWT/jwt.service';
import { AuthGuard } from 'src/middlewares/auth.middleware';
import { ApiKeyGuard } from 'src/middlewares/api-key.middleware';
import { RequestContextModule } from 'src/common/context/request-context.module';

@Module({
  imports: [RequestContextModule],
  providers: [JwtService, AuthGuard, ApiKeyGuard],
  exports: [JwtService, AuthGuard, ApiKeyGuard, RequestContextModule],
})
export class JwtModule {}

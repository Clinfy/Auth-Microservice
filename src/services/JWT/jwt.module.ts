import { Module } from '@nestjs/common';
import { JwtService } from 'src/services/JWT/jwt.service';
import { AuthGuard } from 'src/middlewares/auth.middleware';
import { ApiKeyGuard } from 'src/middlewares/api-key.middleware';
import { RequestContextService } from 'src/common/context/request-context.service';

@Module({
  providers: [JwtService, AuthGuard, ApiKeyGuard, RequestContextService],
  exports: [JwtService, AuthGuard, ApiKeyGuard, RequestContextService],
})
export class JwtModule {}

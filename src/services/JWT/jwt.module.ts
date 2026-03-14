import { Module } from '@nestjs/common';
import { JwtService } from 'src/services/JWT/jwt.service';
import { AuthGuard } from 'src/middlewares/auth.middleware';
import { ApiKeyGuard } from 'src/middlewares/api-key.middleware';
import { MicroserviceGuard } from 'src/middlewares/microservice.middleware';
import { RequestContextModule } from 'src/common/context/request-context.module';

@Module({
  imports: [RequestContextModule],
  providers: [JwtService, AuthGuard, ApiKeyGuard, MicroserviceGuard],
  exports: [JwtService, AuthGuard, ApiKeyGuard, MicroserviceGuard, RequestContextModule],
})
export class JwtModule {}

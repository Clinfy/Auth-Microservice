import { Module } from '@nestjs/common';
import { JwtService } from 'src/services/jwt/jwt.service';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import { MicroserviceGuard } from 'src/common/guards/microservice.guard';
import { RequestContextModule } from 'src/common/context/request-context.module';

@Module({
  imports: [RequestContextModule],
  providers: [JwtService, AuthGuard, ApiKeyGuard, MicroserviceGuard],
  exports: [JwtService, AuthGuard, ApiKeyGuard, MicroserviceGuard, RequestContextModule],
})
export class JwtModule {}

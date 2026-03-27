import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { entities } from './entities';
import { PermissionsModule } from './services/permissions/permissions.module';
import { ApiKeysModule } from 'src/services/api-keys/api-keys.module';
import { UsersModule } from 'src/services/users/users.module';
import { RolesModule } from 'src/services/roles/roles.module';
import { JwtModule } from 'src/services/jwt/jwt.module';
import { EmailModule } from 'src/clients/email/email.module';
import { IsUniquePermissionCodeConstraint } from 'src/common/validators/unique-permission-code.validator';
import { IsUniqueRoleNameConstraint } from 'src/common/validators/unique-role-name.validator';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ScheduleModule } from '@nestjs/schedule';
import { OutboxPublisherService } from 'src/cron/outbox-publisher.service';
import { OutboxSubscriberService } from 'src/cron/outbox-subscriber.service';
import { EprCacheReconciliationService } from 'src/cron/epr-cache-reconciliation.service';
import { ApiKeysCacheReconciliationService } from 'src/cron/api-keys-cache-reconciliation.service';
import { RequestContextMiddleware } from 'src/middlewares/request-context.middleware';
import { RequestContextModule } from 'src/common/context/request-context.module';
import { RedisModule } from 'src/common/redis/redis.module';
import { SessionsModule } from 'src/services/sessions/sessions.module';
import { validate } from 'src/config/env-validation';
import { WinstonModule } from 'nest-winston';
import winston from 'winston';
import 'winston-daily-rotate-file';
import { AllExceptionsFilter } from 'src/common/filters/all-exceptions.filter';
import { ObservabilityModule } from 'src/observability/observability.module';
import { EndpointPermissionRulesModule } from 'src/services/endpoint-permission-rules/endpoint-permission-rules.module';
import { IsUniqueEndpointKeyNameConstraint } from 'src/common/validators/unique-endpoint-key.validator';
import { OutboxCleanupService } from 'src/cron/outbox-cleanup.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get('DATABASE_HOST'),
        entities: [...entities],
        synchronize: true,
      }),
    }),

    ClientsModule.registerAsync([
      {
        imports: [ConfigModule],
        inject: [ConfigService],
        name: 'AUDIT_SERVICE',
        useFactory: async (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL') as string],
            queue: 'audit_queue',
            queueOptions: {
              durable: true,
            },
          },
        }),
      },
    ]),

    WinstonModule.forRoot({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      transports: [
        //new winston.transports.Console(),
        new winston.transports.DailyRotateFile({
          filename: 'logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxSize: '5m',
          maxFiles: '14d',
        }),
        new winston.transports.DailyRotateFile({
          filename: 'logs/combined-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '10m',
          maxFiles: '30d',
        }),
      ],
    }),

    RedisModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature(entities),
    PermissionsModule,
    RequestContextModule,
    ApiKeysModule,
    UsersModule,
    RolesModule,
    SessionsModule,
    JwtModule,
    EmailModule,
    ObservabilityModule,
    EndpointPermissionRulesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AllExceptionsFilter,
    IsUniquePermissionCodeConstraint,
    IsUniqueRoleNameConstraint,
    IsUniqueEndpointKeyNameConstraint,
    OutboxPublisherService,
    OutboxSubscriberService,
    OutboxCleanupService,
    EprCacheReconciliationService,
    ApiKeysCacheReconciliationService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}

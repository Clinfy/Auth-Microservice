import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { entities } from "./entities";
import { PermissionsModule } from './services/permissions/permissions.module';
import { ApiKeysModule } from 'src/services/api-keys/api-keys.module';
import { UsersModule } from 'src/services/users/users.module';
import { RolesModule } from 'src/services/roles/roles.module';
import { JwtModule } from 'src/services/JWT/jwt.module';
import { EmailModule } from 'src/clients/email/email.module';
import { IsUniquePermissionCodeConstraint } from 'src/common/validators/unique-permission-code.validator';
import { IsUniqueRoleNameConstraint } from 'src/common/validators/unique-role-name.validator';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ScheduleModule } from '@nestjs/schedule';
import { OutboxPublisherService } from 'src/cron/outbox-publisher.service';
import { OutboxSubscriberService } from 'src/cron/outbox-subscriber.service';
import { RequestContextService } from 'src/common/context/request-context.service';

@Module({
imports: [ConfigModule.forRoot({
  isGlobal: true,
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
            durable: true
          }
        }
      })
    }
  ]),

  ScheduleModule.forRoot(),
  TypeOrmModule.forFeature(entities),
  PermissionsModule,
  ApiKeysModule,
  UsersModule,
  RolesModule,
  JwtModule,
  EmailModule
],
controllers: [AppController],
providers: [AppService, IsUniquePermissionCodeConstraint, IsUniqueRoleNameConstraint, OutboxPublisherService, OutboxSubscriberService, RequestContextService],
})
export class AppModule {}

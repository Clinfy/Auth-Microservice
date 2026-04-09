import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionEntity } from 'src/entities/permission.entity';
import { EndpointPermissionRulesEntity } from 'src/entities/endpoint-permission-rules.entity';
import { RoleEntity } from 'src/entities/role.entity';
import { UserEntity } from 'src/entities/user.entity';
import { ApiKeyEntity } from 'src/entities/api-key.entity';
import { OutboxEntity } from 'src/entities/outbox.entity';
import { SeedService } from './seed.service';

/**
 * Minimal NestJS module for database seeding.
 * Only imports ConfigModule (for DATABASE_HOST_TEST) and TypeOrmModule with required entities.
 * Does NOT import Redis, RabbitMQ, schedulers, or other production modules.
 *
 * All entities must be included to satisfy TypeORM's ManyToMany relation metadata resolution.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get('DATABASE_HOST'),
        entities: [PermissionEntity, EndpointPermissionRulesEntity, RoleEntity, UserEntity, ApiKeyEntity, OutboxEntity],
        synchronize: true, // Create tables if they don't exist
      }),
    }),
  ],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}

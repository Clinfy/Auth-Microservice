import { Module } from '@nestjs/common';
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
    TypeOrmModule.forFeature(entities),
    PermissionsModule,
    ApiKeysModule,
    UsersModule,
    RolesModule,
    JwtModule
],
controllers: [AppController],
providers: [AppService],
})
export class AppModule {}
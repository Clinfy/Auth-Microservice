import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { entities } from "./entities";
import { UsersController } from './services/users/users.controller';
import { UsersService } from './services/users/users.service';
import { PermissionsService } from './services/permissions/permissions.service';
import { PermissionsController } from './services/permissions/permissions.controller';
import { RolesController } from './services/roles/roles.controller';
import { RolesService } from './services/roles/roles.service';
import { JwtService } from "src/services/JWT/jwt.service";
import { AuthGuard } from "src/middlewares/auth.middleware";
import { IsUniqueEmailConstraint } from "src/common/validators/unique-email.validator";
import { ApiKeyGuard } from "src/middlewares/api-key.middleware";
import { ApiKeysController } from './services/api-keys/api-keys.controller';
import { ApiKeysService } from './services/api-keys/api-keys.service';
import { EmailService } from 'src/services/email/email.service';

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
],
controllers: [AppController, UsersController, PermissionsController, RolesController, ApiKeysController],
providers: [JwtService, AuthGuard, ApiKeyGuard, AppService, IsUniqueEmailConstraint, UsersService, PermissionsService, RolesService, ApiKeysService, EmailService],
})
export class AppModule {}
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
import { EmailModule } from 'src/clients/email/email.module';
import { IsUniquePermissionCodeConstraint } from 'src/common/validators/unique-permission-code.validator';
import { IsUniqueRoleNameConstraint } from 'src/common/validators/unique-role-name.validator';

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
    JwtModule,
    EmailModule
],
controllers: [AppController],
providers: [AppService, IsUniquePermissionCodeConstraint, IsUniqueRoleNameConstraint],
})
export class AppModule {}
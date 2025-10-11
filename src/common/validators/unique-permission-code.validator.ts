import { Injectable } from '@nestjs/common';
import {
    registerDecorator, ValidationArguments, ValidationOptions,
    ValidatorConstraint, ValidatorConstraintInterface,
} from 'class-validator';
import { DataSource, Not } from 'typeorm';
import { PermissionEntity } from 'src/entities/permission.entity';

@ValidatorConstraint({ name: 'IsUniquePermissionCode', async: true })
@Injectable()
export class IsUniquePermissionCodeConstraint implements ValidatorConstraintInterface {
    constructor(private readonly dataSource: DataSource) {}

    async validate(value: string, args: ValidationArguments) {
        if (!value) return true;
        const ignoreIdField = (args.constraints?.[0]?.ignoreIdField as string) || 'id';
        const ignoreId = (args.object as any)?.[ignoreIdField];

        const where: any = { code: value };
        if (ignoreId) where.id = Not(ignoreId);

        const repo = this.dataSource.getRepository(PermissionEntity);
        const exists = await repo.exist({ where });
        return !exists;
    }

    defaultMessage() {
        return 'This permission code is already register. Please choose another one.';
    }
}

export function IsUniquePermissionCode(
    options?: { ignoreIdField?: string },
    validationOptions?: ValidationOptions,
) {
    return function (object: any, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName,
            constraints: [options || {}],
            options: validationOptions,
            validator: IsUniquePermissionCodeConstraint,
        });
    };
}
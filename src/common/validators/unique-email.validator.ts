import { Injectable } from '@nestjs/common';
import {
    registerDecorator, ValidationArguments, ValidationOptions,
    ValidatorConstraint, ValidatorConstraintInterface,
} from 'class-validator';
import { DataSource, Not } from 'typeorm';
import { UserEntity } from 'src/entities/user.entity';

@ValidatorConstraint({ name: 'IsUniqueEmail', async: true })
@Injectable()
export class IsUniqueEmailConstraint implements ValidatorConstraintInterface {
    constructor(private readonly dataSource: DataSource) {}

    async validate(value: string, args: ValidationArguments) {
        if (!value) return true;
        const ignoreIdField = (args.constraints?.[0]?.ignoreIdField as string) || 'id';
        const ignoreId = (args.object as any)?.[ignoreIdField];

        const where: any = { email: value };
        if (ignoreId) where.id = Not(ignoreId);

        const repo = this.dataSource.getRepository(UserEntity);
        const exists = await repo.exist({ where });
        return !exists;
    }

    defaultMessage() {
        return 'Ya existe un usuario con ese email.';
    }
}

export function IsUniqueEmail(
    options?: { ignoreIdField?: string },
    validationOptions?: ValidationOptions,
) {
    return function (object: any, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName,
            constraints: [options || {}],
            options: validationOptions,
            validator: IsUniqueEmailConstraint,
        });
    };
}
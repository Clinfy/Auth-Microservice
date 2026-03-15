import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { DataSource, Not } from 'typeorm';
import { UserEntity } from 'src/entities/user.entity';
import { Injectable } from '@nestjs/common';
import { UsersErrorCodes } from 'src/services/users/users.exception.handler';

@ValidatorConstraint({ name: 'IsUniquePerson', async: true })
@Injectable()
export class IsUniquePersonConstraint implements ValidatorConstraintInterface {
  constructor(private readonly dataSource: DataSource) {}

  async validate(value: string, args: ValidationArguments) {
    if (!value) return true;
    const ignoreIdField = (args.constraints?.[0]?.ignoreIdField as string) || 'id';
    const ignoreId = (args.object as any)?.[ignoreIdField];

    const where: any = { person_id: value };
    if (ignoreId) where.id = Not(ignoreId);

    const repo = this.dataSource.getRepository(UserEntity);
    const exists = await repo.exists({ where });
    return !exists;
  }

  defaultMessage() {
    return 'This person already has an account registered.';
  }
}

export function IsUniquePerson(options?: { ignoreIdField?: string }, validationOptions?: ValidationOptions) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      constraints: [options || {}],
      options: {
        ...validationOptions,
        context: {
          errorCode: UsersErrorCodes.USER_PERSON_ALREADY_REGISTERED,
          ...validationOptions?.context,
        },
      },
      validator: IsUniquePersonConstraint,
    });
  };
}

import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { DataSource, Not } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { EndpointPermissionRulesEntity } from 'src/entities/endpoint-permission-rules.entity';
import { EndpointPermissionRulesErrorCodes } from 'src/services/endpoint-permission-rules/endpoint-permission-rules.exception';

@ValidatorConstraint({ name: 'IsUniqueEndpointKeyName', async: true })
@Injectable()
export class IsUniqueEndpointKeyNameConstraint implements ValidatorConstraintInterface {
  constructor(private readonly dataSource: DataSource) {}

  async validate(value: string, args: ValidationArguments) {
    if (!value) return true;
    const ignoreIdField = (args.constraints?.[0]?.ignoreIdField as string) || 'id';
    const ignoreId = (args.object as any)?.[ignoreIdField];

    const where: any = { endpoint_key_name: value };
    if (ignoreId) where.id = Not(ignoreId);

    const repo = this.dataSource.getRepository(EndpointPermissionRulesEntity);
    const exists = await repo.exists({ where });
    return !exists;
  }

  defaultMessage() {
    return 'This endpoint key is already registered.';
  }
}

export function IsUniqueEndpointKeyName(options?: { ignoreIdField?: string }, validationOptions?: ValidationOptions) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      constraints: [options || {}],
      options: {
        ...validationOptions,
        context: {
          errorCode: EndpointPermissionRulesErrorCodes.ENDPOINT_PERMISSION_RULE_ALREADY_EXISTS,
          ...validationOptions?.context,
        },
      },
      validator: IsUniqueEndpointKeyNameConstraint,
    });
  };
}

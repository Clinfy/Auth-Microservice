import { HttpException, HttpStatus } from '@nestjs/common';

export enum RolesErrorCodes {
  ROLES_NOT_FOUND = 'ROLE_NOT_FOUND',
  ROLES_ALREADY_EXISTS = 'ROLE_ALREADY_EXISTS',
  ROLES_NOT_ASSIGNED = 'ROLE_NOT_ASSIGNED',
  ROLES_NOT_DELETED = 'ROLE_NOT_DELETED',
  ROLES_NOT_UPDATED = 'ROLE_NOT_UPDATED',
  ROLES_NOT_CREATED = 'ROLE_NOT_CREATED',
}

export class RolesException extends HttpException {
  constructor(message: string, errorCode: RolesErrorCodes, status: HttpStatus) {
    super(
      {
        message,
        errorCode,
        statusCode: status,
      },
      status,
    );
  }
}

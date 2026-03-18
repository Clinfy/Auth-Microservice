import { HttpStatus } from '@nestjs/common';
import { BaseServiceException } from 'src/common/exceptions/base-service.exception';

export enum RolesErrorCodes {
  ROLES_NOT_FOUND = 'ROLE_NOT_FOUND',
  ROLES_ALREADY_EXISTS = 'ROLE_ALREADY_EXISTS',
  ROLES_ASSIGN_ERROR = 'ROLE_PERMISSION_ASSIGN_ERROR',
  ROLES_NOT_DELETED = 'ROLE_NOT_DELETED',
  ROLES_NOT_UPDATED = 'ROLE_NOT_UPDATED',
  ROLES_NOT_CREATED = 'ROLE_NOT_CREATED',
}

export class RolesException extends BaseServiceException {
  constructor(message: string, errorCode: RolesErrorCodes, status: HttpStatus, cause?: Error) {
    super(message, errorCode, status, cause);
  }
}

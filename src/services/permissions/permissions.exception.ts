import { HttpStatus } from '@nestjs/common';
import { BaseServiceException } from 'src/common/exceptions/base-service.exception';

export enum PermissionsErrorCodes {
  CREATE_PERMISSION_FAILED = 'CREATE_PERMISSION_FAILED',
  UPDATE_PERMISSION_FAILED = 'UPDATE_PERMISSION_FAILED',
  DELETE_PERMISSION_FAILED = 'DELETE_PERMISSION_FAILED',
  PERMISSION_NOT_FOUND = 'PERMISSION_NOT_FOUND',
  PERMISSION_ALREADY_EXISTS = 'PERMISSION_ALREADY_EXISTS',
}

export class PermissionsException extends BaseServiceException {
  constructor(message: string, errorCode: PermissionsErrorCodes, status: HttpStatus, cause?: Error) {
    super(message, errorCode, status, cause);
  }
}

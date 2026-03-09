import { HttpException, HttpStatus } from '@nestjs/common';

export enum PermissionsErrorCodes {
  CREATE_PERMISSION_FAILED = 'CREATE_PERMISSION_FAILED',
  UPDATE_PERMISSION_FAILED = 'UPDATE_PERMISSION_FAILED',
  DELETE_PERMISSION_FAILED = 'DELETE_PERMISSION_FAILED',
  PERMISSION_NOT_FOUND = 'PERMISSION_NOT_FOUND',
  PERMISSION_ALREADY_EXISTS = 'PERMISSION_ALREADY_EXISTS',
}

export class PermissionsException extends HttpException {
  constructor(message: string, errorCode: PermissionsErrorCodes, status: HttpStatus) {
    super({ message, errorCode, statusCode: status }, status);
  }
}
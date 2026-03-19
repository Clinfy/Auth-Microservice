import { HttpStatus } from '@nestjs/common';
import { BaseServiceException } from 'src/common/exceptions/base-service.exception';

export enum ApiKeyErrorCodes {
  API_KEY_NOT_CREATED = 'API_KEY_NOT_CREATED',
  API_KEY_NOT_FOUND = 'API_KEY_NOT_FOUND',
  API_KEY_ALREADY_DEACTIVATE = 'API_KEY_ALREADY_DEACTIVATE',
}

export class ApiKeyException extends BaseServiceException {
  constructor(message: string, errorCode: ApiKeyErrorCodes, status: HttpStatus, cause?: Error) {
    super(message, errorCode, status, cause);
  }
}

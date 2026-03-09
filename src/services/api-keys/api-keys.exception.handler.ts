import { HttpException, HttpStatus } from '@nestjs/common';

export enum ApiKeyErrorCodes {
  API_KEY_NOT_CREATED = 'API_KEY_NOT_CREATED',
  API_KEY_NOT_FOUND = 'API_KEY_NOT_FOUND',
  API_KEY_ALREADY_DEACTIVATE = 'API_KEY_ALREADY_DEACTIVATE',
}

export class ApiKeyException extends HttpException {
  constructor(message: string, errorCode: ApiKeyErrorCodes, status: HttpStatus) {
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

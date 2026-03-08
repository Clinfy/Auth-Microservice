import { HttpException, HttpStatus } from '@nestjs/common';

export enum JwtErrorCodes {
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_GENERATION_FAILED = 'TOKEN_GENERATION_FAILED',
  TOKEN_VERIFICATION_FAILED = 'TOKEN_VERIFICATION_FAILED',
  TOKEN_SIGNING_FAILED = 'TOKEN_SIGNING_FAILED',
  PAYLOAD_MISSING_DATA = 'TOKEN_PAYLOAD_MISSING_DATA',
  INVALID_REFRESH_TOKEN = 'INVALID_REFRESH_TOKEN',
}

export class JwtException extends HttpException {
  constructor(message: string, errorCode: JwtErrorCodes, status: HttpStatus) {
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
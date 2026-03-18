import { HttpStatus } from '@nestjs/common';
import { BaseServiceException } from 'src/common/exceptions/base-service.exception';

export enum JwtErrorCodes {
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_GENERATION_FAILED = 'TOKEN_GENERATION_FAILED',
  TOKEN_VERIFICATION_FAILED = 'TOKEN_VERIFICATION_FAILED',
  TOKEN_SIGNING_FAILED = 'TOKEN_SIGNING_FAILED',
  PAYLOAD_MISSING_DATA = 'TOKEN_PAYLOAD_MISSING_DATA',
  INVALID_REFRESH_TOKEN = 'INVALID_REFRESH_TOKEN',
  INVALID_PAYLOAD = 'INVALID_PAYLOAD',
}

export class JwtException extends BaseServiceException {
  constructor(message: string, errorCode: JwtErrorCodes, status: HttpStatus, cause?: Error) {
    super(message, errorCode, status, cause);
  }
}

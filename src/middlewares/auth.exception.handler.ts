import { HttpException, HttpStatus } from '@nestjs/common';

export enum AuthErrorCodes {
  AUTH_HEADER_MISSING = 'AUTH_HEADER_MISSING',
  AUTH_HEADER_INVALID = 'AUTH_HEADER_INVALID',
  SESSION_INVALID = 'SESSION_INVALID',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_TOKEN_MISMATCH = 'SESSION_TOKEN_MISMATCH',
  SESSION_IP_MISMATCH = 'SESSION_IP_MISMATCH',
  SESSION_USER_AGENT_MISMATCH = 'SESSION_USER_AGENT_MISMATCH',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  API_KEY_INVALID = 'API_KEY_INVALID',
}

export class AuthException extends HttpException {
  constructor (message: string, errorCode: AuthErrorCodes, status: HttpStatus) {
    super ({message, errorCode, statusCode: status}, status);
  }
}
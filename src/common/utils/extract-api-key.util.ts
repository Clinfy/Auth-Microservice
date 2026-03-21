import { Request } from 'express';
import { HttpStatus } from '@nestjs/common';
import { AuthErrorCodes, AuthException } from 'src/common/guards/auth.exception';

export function extractApiKey(request: Request): string {
  const headerValue = request.headers['x-api-key'];

  if (Array.isArray(headerValue)) {
    throw new AuthException(
      'API key header must be a single value',
      AuthErrorCodes.API_KEY_INVALID,
      HttpStatus.UNAUTHORIZED,
    );
  }

  if (typeof headerValue !== 'string' || headerValue.trim().length === 0) {
    throw new AuthException('API key header missing', AuthErrorCodes.API_KEY_HEADER_MISSING, HttpStatus.UNAUTHORIZED);
  }

  return headerValue.trim();
}

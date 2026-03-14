import { CookieOptions } from 'express';
import { getTtlFromEnv } from './get-ttl';

export function getAuthCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== 'false',
    sameSite: 'strict',
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined,
    maxAge: getTtlFromEnv('JWT_AUTH_EXPIRES_IN'),
  };
}

export function getRefreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== 'false',
    sameSite: 'strict',
    path: '/users/refresh-token',
    domain: process.env.COOKIE_DOMAIN || undefined,
    maxAge: getTtlFromEnv('JWT_REFRESH_EXPIRES_IN'),
  };
}

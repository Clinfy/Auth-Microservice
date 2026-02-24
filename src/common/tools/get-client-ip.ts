import { Request } from 'express';

export function getClientIp(req: Request) {
  const xff = req.headers['x-forwarded-for'];
  const ip =
    (typeof xff === 'string' ? xff.split(',')[0].trim() : undefined) ||
    req.ip ||
    req.socket?.remoteAddress ||
    'unknown';

  if (ip === '::1') return '127.0.0.1';

  if (ip.startsWith('::ffff:')) return ip.replace('::ffff:', '');

  return ip;
}
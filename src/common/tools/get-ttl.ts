import ms, { StringValue } from 'ms';

export function getTtlFromEnv (key:string): number {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable ${key}`);

  return Math.floor(ms(value as StringValue));
}
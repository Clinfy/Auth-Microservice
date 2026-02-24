import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from './jwt.service';

jest.mock('jsonwebtoken', () => {
  const sign = jest.fn();
  const verify = jest.fn();

  class MockTokenExpiredError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'TokenExpiredError';
    }
  }

  class MockJsonWebTokenError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'JsonWebTokenError';
    }
  }

  class MockNotBeforeError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NotBeforeError';
    }
  }

  return {
    sign,
    verify,
    TokenExpiredError: MockTokenExpiredError,
    JsonWebTokenError: MockJsonWebTokenError,
    NotBeforeError: MockNotBeforeError,
  };
});

const jsonwebtoken = require('jsonwebtoken') as any;
const signMock = jsonwebtoken.sign as jest.Mock;
const verifyMock = jsonwebtoken.verify as jest.Mock;
const { TokenExpiredError, JsonWebTokenError, NotBeforeError } = jsonwebtoken as {
  TokenExpiredError: new (message: string) => Error;
  JsonWebTokenError: new (message: string) => Error;
  NotBeforeError: new (message: string) => Error;
};

let diffMinutes = 10;

function buildDayjsMock() {
  const mock: any = () => ({});
  mock.unix = (_exp: number) => ({
    diff: (_now: any, _unit: string) => diffMinutes,
  });
  return mock;
}

jest.mock('dayjs', () => buildDayjsMock());

describe('JwtService', () => {
  let service: JwtService;
  let config: jest.Mocked<ConfigService>;

  beforeEach(() => {
    signMock.mockReset();
    verifyMock.mockReset();
    diffMinutes = 10;

    config = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const map: Record<string, any> = {
          JWT_AUTH_SECRET: 'auth-secret',
          JWT_AUTH_EXPIRES_IN: '1d',
          JWT_REFRESH_SECRET: 'refresh-secret',
          JWT_REFRESH_EXPIRES_IN: '7d',
          JWT_RESET_PASSWORD_SECRET: 'reset-secret',
          JWT_RESET_PASSWORD_EXPIRES_IN: '5m',
          JWT_REFRESH_RENEW_THRESHOLD_MINUTES: '20',
        };
        return key in map ? map[key] : defaultValue;
      }),
    } as any;

    service = new JwtService(config);
  });

  it('generates JWT tokens via jsonwebtoken.sign', async () => {
    signMock.mockImplementation((_payload, _secret, _options, callback) => callback(null, 'TOKEN'));

    await expect(service.generateToken({ email: 'user@example.com' }, 'auth')).resolves.toBe('TOKEN');
    expect(signMock).toHaveBeenCalledWith(
      { email: 'user@example.com' },
      'auth-secret',
      expect.objectContaining({ expiresIn: '1d' }),
      expect.any(Function),
    );
  });

  it('wraps signing errors in InternalServerErrorException', async () => {
    signMock.mockImplementation((_payload, _secret, _options, callback) => callback(new Error('fail')));

    await expect(service.generateToken({ email: 'user@example.com' }, 'auth')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('getPayload returns decoded payload', async () => {
    verifyMock.mockImplementation((_token, _secret, callback) =>
      callback(null, { email: 'user@example.com', exp: 1 }),
    );

    await expect(service.getPayload('token', 'auth')).resolves.toEqual({ email: 'user@example.com', exp: 1 });
  });

  it('getPayload enforces sid presence for refresh and reset tokens', async () => {
    verifyMock.mockImplementation((_token, _secret, callback) =>
      callback(null, { email: 'user@example.com', exp: 1 }),
    );

    await expect(service.getPayload('token', 'refresh')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.getPayload('token', 'resetPassword')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('getPayload maps token errors to UnauthorizedException', async () => {
    verifyMock.mockImplementation((_token, _secret, callback) => callback(new TokenExpiredError('expired'), undefined));
    await expect(service.getPayload('token', 'auth')).rejects.toBeInstanceOf(UnauthorizedException);

    verifyMock.mockImplementation((_token, _secret, callback) =>
      callback(new JsonWebTokenError('invalid'), undefined),
    );
    await expect(service.getPayload('token', 'auth')).rejects.toBeInstanceOf(UnauthorizedException);

    verifyMock.mockImplementation((_token, _secret, callback) => callback(new NotBeforeError('nbf'), undefined));
    await expect(service.getPayload('token', 'auth')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refreshToken rotates refresh token when close to expiry', async () => {
    verifyMock.mockImplementation((_token, _secret, callback) =>
      callback(null, { email: 'user@example.com', exp: 1, sid: 'session-1' }),
    );
    signMock
      .mockImplementationOnce((_payload, _secret, _options, callback) => callback(null, 'ACCESS'))
      .mockImplementationOnce((_payload, _secret, _options, callback) => callback(null, 'NEW_REFRESH'));

    await expect(service.refreshToken('old-refresh')).resolves.toEqual({
      accessToken: 'ACCESS',
      refreshToken: 'NEW_REFRESH',
    });
  });

  it('refreshToken reuses existing refresh token when far from expiry', async () => {
    diffMinutes = 999;
    verifyMock.mockImplementation((_token, _secret, callback) =>
      callback(null, { email: 'user@example.com', exp: 1, sid: 'session-1' }),
    );
    signMock.mockImplementation((_payload, _secret, _options, callback) => callback(null, 'ACCESS'));

    await expect(service.refreshToken('same-refresh')).resolves.toEqual({
      accessToken: 'ACCESS',
      refreshToken: 'same-refresh',
    });
  });

  it('refreshToken throws UnauthorizedException on verification error', async () => {
    verifyMock.mockImplementation((_token, _secret, callback) => callback(new Error('boom'), undefined));

    await expect(service.refreshToken('bad-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

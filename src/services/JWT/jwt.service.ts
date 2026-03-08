import { HttpStatus, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  JsonWebTokenError,
  NotBeforeError,
  sign,
  SignOptions,
  TokenExpiredError,
  verify,
} from 'jsonwebtoken';
import dayjs from 'dayjs';
import { Payload } from 'src/interfaces/payload';
import { JwtErrorCodes, JwtException } from 'src/services/JWT/jwt.excpetion.handler';
import { StringValue } from 'ms';

type TokenType = 'refresh' | 'auth';

type TokenConfig = {
  secret: string;
  expiresIn: StringValue;
};

type JwtPayload = { email: string; sid: string };

type TokenPayloadType = {
  auth: JwtPayload;
  refresh: JwtPayload;
};

@Injectable()
export class JwtService {
  private readonly configByType: Record<TokenType, TokenConfig>;
  private readonly refreshRenewThresholdMinutes: number;

  constructor(private readonly configService: ConfigService) {
    this.configByType = {
      auth: {
        secret: this.configService.get<string>('JWT_AUTH_SECRET', 'authSecret'),
        expiresIn: this.configService.get<StringValue>('JWT_AUTH_EXPIRES_IN', '1d'),
      },
      refresh: {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'refreshSecret'),
        expiresIn: this.configService.get<StringValue>('JWT_REFRESH_EXPIRES_IN', '1d'),
      },
    };

    const threshold = Number(this.configService.get<string>('JWT_REFRESH_RENEW_THRESHOLD_MINUTES', '20'));
    this.refreshRenewThresholdMinutes =
      Number.isFinite(threshold) && !Number.isNaN(threshold) && threshold >= 0 ? threshold : 20;
  }

  async generateToken<T extends TokenType>(
    payload: TokenPayloadType[T],
    type: T = 'auth' as T,
  ): Promise<string> {
    try {
      return await this.signToken(payload, this.configByType[type]);
    } catch (error) {
      throw new JwtException(
        'Failed to generate token',
        JwtErrorCodes.TOKEN_GENERATION_FAILED,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = await this.getPayload(refreshToken, 'refresh');

      const timeToExpire = dayjs.unix(payload.exp).diff(dayjs(), 'minute');
      const shouldRotateRefresh = timeToExpire < this.refreshRenewThresholdMinutes;

      const [accessToken, nextRefreshToken] = await Promise.all([
        this.generateToken({ email: payload.email, sid: payload.sid }, 'auth'),
        shouldRotateRefresh
          ? this.generateToken({ email: payload.email, sid: payload.sid }, 'refresh')
          : Promise.resolve(refreshToken),
      ]);

      return {
        accessToken,
        refreshToken: nextRefreshToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new JwtException(
        'Invalid refresh token',
        JwtErrorCodes.INVALID_REFRESH_TOKEN,
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  async getPayload(token: string, type: TokenType): Promise<Payload> {
    const { secret } = this.configByType[type];

    try {
      const decoded = await this.verifyToken<Payload>(token, secret);
      if (!decoded?.email || !decoded.exp) {
        throw new JwtException('Token payload is invalid', JwtErrorCodes.INVALID_PAYLOAD, HttpStatus.UNAUTHORIZED);
      }

      if (type === 'refresh' && !decoded.sid) {
        throw new JwtException(
          'Token payload is missing data',
          JwtErrorCodes.PAYLOAD_MISSING_DATA,
          HttpStatus.UNAUTHORIZED,
        );
      }

      return decoded;
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new JwtException('Token has expired', JwtErrorCodes.TOKEN_EXPIRED, HttpStatus.UNAUTHORIZED);
      }

      if (error instanceof JsonWebTokenError || error instanceof NotBeforeError) {
        throw new JwtException(
          'Token verification failed',
          JwtErrorCodes.TOKEN_VERIFICATION_FAILED,
          HttpStatus.UNAUTHORIZED,
        );
      }

      throw error;
    }
  }

  private signToken(payload: TokenPayloadType[TokenType], config: TokenConfig): Promise<string> {
    return new Promise((resolve, reject) => {
      const options: SignOptions = {
        expiresIn: config.expiresIn,
      };

      sign(payload, config.secret, options, (err, token) => {
        if (err || !token) {
          reject(
            err ??
              new JwtException(
                'Token signing failed',
                JwtErrorCodes.TOKEN_SIGNING_FAILED,
                HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
          return;
        }

        resolve(token);
      });
    });
  }

  private verifyToken<T>(token: string, secret: string): Promise<T> {
    return new Promise((resolve, reject) => {
      verify(token, secret, (err, decoded) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(decoded as T);
      });
    });
  }
}

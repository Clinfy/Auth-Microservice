import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sign, verify, SignOptions, JsonWebTokenError, TokenExpiredError, NotBeforeError } from 'jsonwebtoken';
import dayjs from 'dayjs';
import { Payload } from 'src/interfaces/payload';

type TokenType = 'refresh' | 'auth';

type TokenConfig = {
    secret: string;
    expiresIn: string;
};

@Injectable()
export class JwtService {
    private readonly configByType: Record<TokenType, TokenConfig>;
    private readonly refreshRenewThresholdMinutes: number;

    constructor(private readonly configService: ConfigService) {
        this.configByType = {
            auth: {
                secret: this.configService.get<string>('JWT_AUTH_SECRET', 'authSecret'),
                expiresIn: this.configService.get<string>('JWT_AUTH_EXPIRES_IN', '1d'),
            },
            refresh: {
                secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'refreshSecret'),
                expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '1d'),
            },
        };

        const threshold = Number(this.configService.get<string>('JWT_REFRESH_RENEW_THRESHOLD_MINUTES', '20'));
        this.refreshRenewThresholdMinutes = Number.isFinite(threshold) && !Number.isNaN(threshold) && threshold >= 0 ? threshold : 20;
    }

    async generateToken(payload: { email: string }, type: TokenType = 'auth'): Promise<string> {
        try {
            return await this.signToken(payload, this.configByType[type]);
        } catch (error) {
            throw new InternalServerErrorException('Failed to generate token');
        }
    }

    async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
        try {
            const payload = await this.getPayload(refreshToken, 'refresh');

            const timeToExpire = dayjs.unix(payload.exp).diff(dayjs(), 'minute');
            const shouldRotateRefresh = timeToExpire < this.refreshRenewThresholdMinutes;

            const [accessToken, nextRefreshToken] = await Promise.all([
                this.generateToken({ email: payload.email }, 'auth'),
                shouldRotateRefresh
                    ? this.generateToken({ email: payload.email }, 'refresh')
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
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    async getPayload(token: string, type: TokenType = 'auth'): Promise<Payload> {
        const { secret } = this.configByType[type];

        try {
            const decoded = await this.verifyToken<Payload>(token, secret);
            if (!decoded?.email || !decoded.exp) {
                throw new UnauthorizedException('Token payload is invalid');
            }

            return decoded;
        } catch (error) {
            if (error instanceof TokenExpiredError) {
                throw new UnauthorizedException('Token expired');
            }

            if (error instanceof JsonWebTokenError || error instanceof NotBeforeError) {
                throw new UnauthorizedException('Token verification failed');
            }

            throw error;
        }
    }

    private signToken(payload: { email: string }, config: TokenConfig): Promise<string> {
        return new Promise((resolve, reject) => {
            const options: SignOptions = {
                expiresIn: config.expiresIn,
            };

            sign(payload, config.secret, options, (err, token) => {
                if (err || !token) {
                    reject(err ?? new Error('Token signing failed'));
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

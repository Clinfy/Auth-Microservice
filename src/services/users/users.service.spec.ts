import { ForbiddenException, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { UsersService } from './users.service';
import { JwtService } from '../JWT/jwt.service';
import { RolesService } from '../roles/roles.service';
import { EmailService } from 'src/clients/email/email.service';
import { UserEntity } from 'src/entities/user.entity';
import { RedisService } from 'src/common/redis/redis.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

import { compare } from 'bcrypt';

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: jest.Mocked<Partial<Repository<UserEntity>>>;
  let dataSource: jest.Mocked<Partial<DataSource>>;
  let redisService: { raw: any };
  let jwtService: jest.Mocked<Partial<JwtService>>;
  let roleService: jest.Mocked<Partial<RolesService>>;
  let emailService: jest.Mocked<Partial<EmailService>>;

  beforeEach(() => {
    userRepository = {
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn(),
    };

    redisService = {
      raw: {
        get: jest.fn(),
        set: jest.fn().mockResolvedValue('OK'),
        sAdd: jest.fn().mockResolvedValue(1),
        pExpire: jest.fn().mockResolvedValue(true),
        del: jest.fn().mockResolvedValue(1),
        sRem: jest.fn().mockResolvedValue(1),
      },
    };

    jwtService = {
      generateToken: jest.fn(),
      refreshToken: jest.fn(),
      getPayload: jest.fn(),
    };

    roleService = {
      findOne: jest.fn(),
    };

    emailService = {
      sendResetPasswordMail: jest.fn(),
      confirmPasswordChange: jest.fn(),
    };

    process.env.JWT_REFRESH_EXPIRES_IN = '1000';
    process.env.RESET_PASSWORD_EXPIRES_IN = '1000';

    service = new UsersService(
      userRepository as any,
      dataSource as any,
      redisService as unknown as RedisService,
      jwtService as any,
      roleService as any,
      emailService as any,
    );
  });

  afterEach(() => {
    delete process.env.RESET_PASSWORD_EXPIRES_IN;
  });

  describe('canDo', () => {
    it('returns true when permission exists', async () => {
      redisService.raw.get.mockResolvedValue(
        JSON.stringify({ active: true, permissions: ['EDIT_USER'] }),
      );

      await expect(
        service.canDo({ session_id: 'abc', id: '1', email: '', person_id: '' }, 'EDIT_USER'),
      ).resolves.toBe(true);
      expect(redisService.raw.get).toHaveBeenCalledWith('auth_session:abc');
    });

    it('throws UnauthorizedException when session missing', async () => {
      redisService.raw.get.mockResolvedValue(null);
      await expect(
        service.canDo({ session_id: 'missing', id: '1', email: '', person_id: '' }, 'DELETE_USER'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws ForbiddenException when permission missing', async () => {
      redisService.raw.get.mockResolvedValue(
        JSON.stringify({ active: true, permissions: [] }),
      );

      await expect(
        service.canDo({ session_id: 'abc', id: '1', email: '', person_id: '' }, 'DELETE_USER'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('logIn', () => {
    const activeUser: UserEntity = Object.assign(new UserEntity(), {
      id: 'user-1',
      email: 'john@example.com',
      password: 'hashed-password',
      active: true,
    } as any);

    const request: any = {
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'x-forwarded-for': '203.0.113.5',
      },
      ip: '10.0.0.2',
      socket: { remoteAddress: '10.0.0.2' },
    };

    it('issues access and refresh tokens on success', async () => {
      redisService.raw.set.mockResolvedValue('OK');
      (userRepository.findOne as jest.Mock).mockResolvedValue(activeUser);
      (compare as jest.Mock).mockResolvedValue(true);
      (jwtService.generateToken as jest.Mock)
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      await expect(
        service.logIn({ email: 'john@example.com', password: 'secret' }, request),
      ).resolves.toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      expect(redisService.raw.set).toHaveBeenCalledWith(
        expect.stringMatching(/^auth_session:/),
        expect.any(String),
        { PX: 1000 },
      );
      const [[cacheKey, rawSession]] = redisService.raw.set.mock.calls;
      const sessionId = cacheKey.replace('auth_session:', '');
      const session = JSON.parse(rawSession);
      expect(session).toMatchObject({
        user_id: activeUser.id,
        email: activeUser.email,
        ip: '203.0.113.5',
        userAgent: request.headers['user-agent'],
        device: expect.any(String),
        permissions: [],
        active: true,
      });
      expect(redisService.raw.sAdd).toHaveBeenCalledWith(
        `user_sessions:${activeUser.id}`,
        sessionId,
      );
      expect(redisService.raw.pExpire).toHaveBeenCalledWith(
        `user_sessions:${activeUser.id}`,
        1000,
      );
    });

    it('throws UnauthorizedException when user not found', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.logIn({ email: 'john@example.com', password: 'secret' }, request),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when user inactive', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue({ ...activeUser, active: false });

      await expect(
        service.logIn({ email: 'john@example.com', password: 'secret' }, request),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when password comparison fails', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue(activeUser);
      (compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.logIn({ email: 'john@example.com', password: 'wrong' }, request),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws InternalServerErrorException if token generation fails', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue(activeUser);
      (compare as jest.Mock).mockResolvedValue(true);
      (jwtService.generateToken as jest.Mock).mockRejectedValue(new Error('sign error'));

      await expect(
        service.logIn({ email: 'john@example.com', password: 'secret' }, request),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('logOut', () => {
    it('removes session data from redis', async () => {
      await expect(
        service.logOut({ id: '1', person_id: 'p1', email: 'john@example.com', session_id: 'sess' }),
      ).resolves.toEqual({ message: 'Logged out successfully' });

      expect(redisService.raw.del).toHaveBeenCalledWith('auth_session:sess');
      expect(redisService.raw.sRem).toHaveBeenCalledWith('user_sessions:1', 'sess');
    });
  });

  describe('forgotPassword', () => {
    it('stores reset token and sends email when user exists', async () => {
      const storedUser: any = { id: 'user-1', email: 'user@example.com' };
      (userRepository.findOne as jest.Mock).mockResolvedValue(storedUser);

      await expect(service.forgotPassword({ email: 'user@example.com' })).resolves.toEqual({
        message: expect.any(String),
      });

      expect(redisService.raw.set).toHaveBeenCalledWith(
        expect.stringMatching(/^reset_password:/),
        JSON.stringify({ id: 'user-1' }),
        { PX: expect.any(Number) },
      );
      expect(emailService.sendResetPasswordMail).toHaveBeenCalledWith('user@example.com', expect.any(String));
    });

    it('returns success message without side effects when user missing', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.forgotPassword({ email: 'missing@example.com' })).resolves.toEqual({
        message: expect.any(String),
      });

      expect(redisService.raw.set).not.toHaveBeenCalled();
      expect(emailService.sendResetPasswordMail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('updates password and clears token when payload valid', async () => {
      redisService.raw.get.mockResolvedValue(JSON.stringify({ id: 'user-1' }));
      const storedUser: any = { id: 'user-1', email: 'user@example.com', password: 'old-password' };
      (userRepository.findOneBy as jest.Mock).mockResolvedValue(storedUser);

      await expect(service.resetPassword('token-123', { password: 'new-password' })).resolves.toEqual({
        message: 'Password reset successfully',
      });

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'user@example.com', password: 'new-password' }),
      );
      expect(redisService.raw.del).toHaveBeenCalledWith('reset_password:token-123');
      expect(emailService.confirmPasswordChange).toHaveBeenCalledWith('user@example.com');
    });

    it('throws UnauthorizedException when token invalid or expired', async () => {
      redisService.raw.get.mockResolvedValue(null);

      await expect(service.resetPassword('token', { password: 'new' })).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws NotFoundException when user missing', async () => {
      redisService.raw.get.mockResolvedValue(JSON.stringify({ id: 'missing-id' }));
      (userRepository.findOneBy as jest.Mock).mockResolvedValue(null);

      await expect(service.resetPassword('token', { password: 'new' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('refreshToken', () => {
    it('updates session cache and delegates to jwtService', async () => {
      (jwtService.getPayload as jest.Mock).mockResolvedValue({
        email: 'user@example.com',
        sid: 'sess-1',
        exp: 123,
      });
      redisService.raw.get.mockResolvedValue(
        JSON.stringify({ user_id: 'user-1', permissions: ['PERM1'], active: true }),
      );
      (userRepository.findOneBy as jest.Mock).mockResolvedValue({
        id: 'user-1',
        permissionCodes: ['PERM2'],
      });
      (jwtService.refreshToken as jest.Mock).mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
      });

      await expect(service.refreshToken('refresh-token')).resolves.toEqual({
        accessToken: 'access',
        refreshToken: 'refresh',
      });

      expect(redisService.raw.set).toHaveBeenCalledWith(
        'auth_session:sess-1',
        expect.stringContaining('"permissions":["PERM2"]'),
        { KEEPTTL: true },
      );
      expect(jwtService.refreshToken).toHaveBeenCalledWith('refresh-token');
    });

    it('throws UnauthorizedException when session missing', async () => {
      (jwtService.getPayload as jest.Mock).mockResolvedValue({
        email: 'user@example.com',
        sid: 'sess-1',
        exp: 123,
      });
      redisService.raw.get.mockResolvedValue(null);

      await expect(service.refreshToken('refresh-token')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when session inactive', async () => {
      (jwtService.getPayload as jest.Mock).mockResolvedValue({
        email: 'user@example.com',
        sid: 'sess-1',
        exp: 123,
      });
      redisService.raw.get.mockResolvedValue(
        JSON.stringify({ user_id: 'user-1', active: false }),
      );

      await expect(service.refreshToken('refresh-token')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});

import { UsersException } from './users.exception';
import { DataSource } from 'typeorm';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';
import { JwtService } from 'src/services/jwt/jwt.service';
import { RolesService } from '../roles/roles.service';
import { EmailService } from 'src/clients/email/email.service';
import { UserEntity, UserStatus } from 'src/entities/user.entity';
import { RedisService } from 'src/common/redis/redis.service';
import { RegisterUserDTO } from 'src/interfaces/DTO/register.dto';
import { SessionsService } from 'src/services/sessions/sessions.service';
import { PaginatedResponseDto, PaginationQueryDto } from 'src/interfaces/DTO/pagination.dto';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

import { compare } from 'bcrypt';

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: jest.Mocked<Partial<UsersRepository>>;
  let dataSource: jest.Mocked<Partial<DataSource>>;
  let redisService: { raw: any };
  let jwtService: jest.Mocked<Partial<JwtService>>;
  let roleService: jest.Mocked<Partial<RolesService>>;
  let emailService: jest.Mocked<Partial<EmailService>>;
  let sessionService: jest.Mocked<Partial<SessionsService>>;

  beforeEach(() => {
    userRepository = {
      findOneByEmail: jest.fn(),
      findOneById: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      create: jest.fn((dto) => ({ id: 'mock-id', ...dto }) as UserEntity),
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
      sendRegistrationMail: jest.fn().mockResolvedValue(undefined),
      sendResetPasswordMail: jest.fn(),
      confirmPasswordChange: jest.fn(),
    };

    sessionService = {
      refreshSessionPermissions: jest.fn().mockResolvedValue(undefined),
      refreshSessionPermissionsByRole: jest.fn().mockResolvedValue(undefined),
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
      sessionService as any,
      { info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any,
    );
  });

  afterEach(() => {
    delete process.env.RESET_PASSWORD_EXPIRES_IN;
  });

  describe('canDo', () => {
    it('returns true when permission exists', async () => {
      redisService.raw.get.mockResolvedValue(JSON.stringify({ active: true, permissions: ['EDIT_USER'] }));

      await expect(service.canDo({ session_id: 'abc', id: '1', email: '', person_id: '' }, 'EDIT_USER')).resolves.toBe(true);
      expect(redisService.raw.get).toHaveBeenCalledWith('auth_session:abc');
    });

    it('throws UnauthorizedException when session missing', async () => {
      redisService.raw.get.mockResolvedValue(null);
      await expect(
        service.canDo({ session_id: 'missing', id: '1', email: '', person_id: '' }, 'DELETE_USER'),
      ).rejects.toBeInstanceOf(UsersException);
    });

    it('throws ForbiddenException when permission missing', async () => {
      redisService.raw.get.mockResolvedValue(JSON.stringify({ active: true, permissions: [] }));

      await expect(
        service.canDo({ session_id: 'abc', id: '1', email: '', person_id: '' }, 'DELETE_USER'),
      ).rejects.toBeInstanceOf(UsersException);
    });
  });

  describe('logIn', () => {
    const activeUser: UserEntity = Object.assign(new UserEntity(), {
      id: 'user-1',
      email: 'john@example.com',
      password: 'hashed-password',
      status: UserStatus.ACTIVE,
      roles: [],
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
      (userRepository.findOneByEmail as jest.Mock).mockResolvedValue(activeUser);
      (compare as jest.Mock).mockResolvedValue(true);
      (jwtService.generateToken as jest.Mock).mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token');

      await expect(service.logIn({ email: 'john@example.com', password: 'secret' }, request)).resolves.toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      expect(redisService.raw.set).toHaveBeenCalledWith(expect.stringMatching(/^auth_session:/), expect.any(String), {
        PX: 1000,
      });
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
      expect(redisService.raw.sAdd).toHaveBeenCalledWith(`user_sessions:${activeUser.id}`, sessionId);
      expect(redisService.raw.pExpire).toHaveBeenCalledWith(`user_sessions:${activeUser.id}`, 1000);
    });

    it('throws UnauthorizedException when user not found', async () => {
      (userRepository.findOneByEmail as jest.Mock).mockResolvedValue(null);

      await expect(service.logIn({ email: 'john@example.com', password: 'secret' }, request)).rejects.toBeInstanceOf(
        UsersException,
      );
    });

    it('throws UsersException when user inactive', async () => {
      (userRepository.findOneByEmail as jest.Mock).mockResolvedValue({
        ...activeUser,
        status: UserStatus.INACTIVE,
      });

      await expect(service.logIn({ email: 'john@example.com', password: 'secret' }, request)).rejects.toBeInstanceOf(
        UsersException,
      );
    });

    it('throws UsersException when user is pending', async () => {
      (userRepository.findOneByEmail as jest.Mock).mockResolvedValue({
        ...activeUser,
        status: UserStatus.PENDING,
      });

      await expect(service.logIn({ email: 'john@example.com', password: 'secret' }, request)).rejects.toBeInstanceOf(
        UsersException,
      );
    });

    it('throws UsersException when password comparison fails', async () => {
      (userRepository.findOneByEmail as jest.Mock).mockResolvedValue(activeUser);
      (compare as jest.Mock).mockResolvedValue(false);

      await expect(service.logIn({ email: 'john@example.com', password: 'wrong' }, request)).rejects.toBeInstanceOf(
        UsersException,
      );
    });

    it('throws UsersException if token generation fails', async () => {
      (userRepository.findOneByEmail as jest.Mock).mockResolvedValue(activeUser);
      (compare as jest.Mock).mockResolvedValue(true);
      (jwtService.generateToken as jest.Mock).mockRejectedValue(new Error('sign error'));

      await expect(service.logIn({ email: 'john@example.com', password: 'secret' }, request)).rejects.toBeInstanceOf(
        UsersException,
      );
    });
  });

  describe('logOut', () => {
    it('removes session data from redis', async () => {
      await expect(
        service.logOut({
          id: '1',
          person_id: 'p1',
          email: 'john@example.com',
          session_id: 'sess',
        }),
      ).resolves.toEqual({ message: 'Logged out successfully' });

      expect(redisService.raw.del).toHaveBeenCalledWith('auth_session:sess');
      expect(redisService.raw.sRem).toHaveBeenCalledWith('user_sessions:1', 'sess');
    });
  });

  describe('forgotPassword', () => {
    it('stores reset token and sends email when user exists', async () => {
      const storedUser: any = { id: 'user-1', email: 'user@example.com' };
      (userRepository.findOneByEmail as jest.Mock).mockResolvedValue(storedUser);

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
      (userRepository.findOneByEmail as jest.Mock).mockResolvedValue(null);

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
      const storedUser: any = {
        id: 'user-1',
        email: 'user@example.com',
        password: 'old-password',
      };
      (userRepository.findOneById as jest.Mock).mockResolvedValue(storedUser);

      await expect(service.resetPassword('token-123', { password: 'new-password' })).resolves.toEqual({
        message: 'Password reset successfully',
      });

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'user@example.com',
          password: 'new-password',
        }),
      );
      expect(redisService.raw.del).toHaveBeenCalledWith('reset_password:token-123');
      expect(emailService.confirmPasswordChange).toHaveBeenCalledWith('user@example.com');
    });

    it('throws UsersException when token invalid or expired', async () => {
      redisService.raw.get.mockResolvedValue(null);

      await expect(service.resetPassword('token', { password: 'new' })).rejects.toBeInstanceOf(UsersException);
    });

    it('throws UsersException when user missing', async () => {
      redisService.raw.get.mockResolvedValue(JSON.stringify({ id: 'missing-id' }));
      (userRepository.findOneById as jest.Mock).mockResolvedValue(null);

      await expect(service.resetPassword('token', { password: 'new' })).rejects.toBeInstanceOf(UsersException);
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
        JSON.stringify({
          user_id: 'user-1',
          permissions: ['PERM1'],
          active: true,
        }),
      );
      (userRepository.findOneById as jest.Mock).mockResolvedValue({
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

    it('throws UsersException when session missing', async () => {
      (jwtService.getPayload as jest.Mock).mockResolvedValue({
        email: 'user@example.com',
        sid: 'sess-1',
        exp: 123,
      });
      redisService.raw.get.mockResolvedValue(null);

      await expect(service.refreshToken('refresh-token')).rejects.toBeInstanceOf(UsersException);
    });

    it('throws UsersException when session inactive', async () => {
      (jwtService.getPayload as jest.Mock).mockResolvedValue({
        email: 'user@example.com',
        sid: 'sess-1',
        exp: 123,
      });
      redisService.raw.get.mockResolvedValue(JSON.stringify({ user_id: 'user-1', active: false }));

      await expect(service.refreshToken('refresh-token')).rejects.toBeInstanceOf(UsersException);
    });
  });

  describe('register', () => {
    it('creates a user inside a transaction and returns a success message', async () => {
      const dto: RegisterUserDTO = { email: 'new@example.com', person_id: 'p-1' };
      const request = { user: { id: 'admin-1' } } as any;

      (dataSource.transaction as jest.Mock).mockImplementation(async (cb) => {
        return cb({});
      });
      (userRepository.save as jest.Mock).mockResolvedValue({ id: 'new-id', email: dto.email });

      const result = await service.register(dto, request);

      expect(result).toEqual({ message: 'User new@example.com created' });
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: dto.email,
          person_id: dto.person_id,
          password: expect.any(String), // auto-generated hex password
          created_by: request.user,
        }),
      );
      expect(emailService.sendRegistrationMail).toHaveBeenCalledWith(dto.email, expect.any(String));
    });
  });

  describe('firstActivation', () => {
    it('activates a pending user with correct temporary password', async () => {
      const storedUser: any = {
        id: 'u-1',
        email: 'user@example.com',
        password: 'hashed',
        status: UserStatus.PENDING,
      };
      (userRepository.findOneByEmail as jest.Mock).mockResolvedValue(storedUser);
      (compare as jest.Mock).mockResolvedValue(true);
      (userRepository.save as jest.Mock).mockResolvedValue(storedUser);

      await expect(
        service.firstActivation({ email: 'user@example.com', password: 'temp', new_password: 'N3w!' }),
      ).resolves.toEqual({ message: 'User activated successfully' });

      expect(storedUser.status).toBe(UserStatus.ACTIVE);
      expect(storedUser.password).toBe('N3w!');
    });

    it('throws UsersException when user does not exist', async () => {
      (userRepository.findOneByEmail as jest.Mock).mockResolvedValue(null);

      await expect(
        service.firstActivation({ email: 'no@example.com', password: 'temp', new_password: 'N3w!' }),
      ).rejects.toBeInstanceOf(UsersException);
    });

    it('throws UsersException when user already activated', async () => {
      (userRepository.findOneByEmail as jest.Mock).mockResolvedValue({
        id: 'u-1',
        status: UserStatus.ACTIVE,
      });

      await expect(
        service.firstActivation({ email: 'user@example.com', password: 'temp', new_password: 'N3w!' }),
      ).rejects.toBeInstanceOf(UsersException);
    });

    it('throws UsersException when password is wrong', async () => {
      (userRepository.findOneByEmail as jest.Mock).mockResolvedValue({
        id: 'u-1',
        email: 'user@example.com',
        password: 'hashed',
        status: UserStatus.PENDING,
      });
      (compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.firstActivation({ email: 'user@example.com', password: 'wrong', new_password: 'N3w!' }),
      ).rejects.toBeInstanceOf(UsersException);
    });
  });

  describe('activate', () => {
    it('activates an inactive user', async () => {
      const storedUser: any = { id: 'u-1', status: UserStatus.INACTIVE };
      (userRepository.findOneById as jest.Mock).mockResolvedValue(storedUser);
      (userRepository.save as jest.Mock).mockResolvedValue(storedUser);

      await expect(service.activate('u-1')).resolves.toEqual({
        message: 'User activated successfully',
      });
      expect(storedUser.status).toBe(UserStatus.ACTIVE);
    });

    it('throws UsersException when user is not inactive', async () => {
      (userRepository.findOneById as jest.Mock).mockResolvedValue({
        id: 'u-1',
        status: UserStatus.ACTIVE,
      });

      await expect(service.activate('u-1')).rejects.toBeInstanceOf(UsersException);
    });

    it('throws UsersException when user does not exist', async () => {
      (userRepository.findOneById as jest.Mock).mockResolvedValue(null);

      await expect(service.activate('missing')).rejects.toBeInstanceOf(UsersException);
    });
  });

  describe('deactivate', () => {
    it('deactivates an active user', async () => {
      const storedUser: any = { id: 'u-1', status: UserStatus.ACTIVE };
      (userRepository.findOneById as jest.Mock).mockResolvedValue(storedUser);
      (userRepository.save as jest.Mock).mockResolvedValue(storedUser);

      await expect(service.deactivate('u-1')).resolves.toEqual({
        message: 'User deactivated successfully',
      });
      expect(storedUser.status).toBe(UserStatus.INACTIVE);
    });

    it('throws UsersException when user is not active', async () => {
      (userRepository.findOneById as jest.Mock).mockResolvedValue({
        id: 'u-1',
        status: UserStatus.INACTIVE,
      });

      await expect(service.deactivate('u-1')).rejects.toBeInstanceOf(UsersException);
    });

    it('throws UsersException when user does not exist', async () => {
      (userRepository.findOneById as jest.Mock).mockResolvedValue(null);

      await expect(service.deactivate('missing')).rejects.toBeInstanceOf(UsersException);
    });
  });

  describe('findAll', () => {
    it('returns a PaginatedResponseDto wrapping users from repository', async () => {
      const users = [{ id: 'u-1' }, { id: 'u-2' }] as UserEntity[];
      (userRepository.findAll as jest.Mock).mockResolvedValue([users, 2]);

      const query = new PaginationQueryDto();
      const result = await service.findAll(query);

      expect(result).toBeInstanceOf(PaginatedResponseDto);
      expect(result.data).toEqual(users);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(userRepository.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('assignRole', () => {
    it('assigns roles to a user and saves', async () => {
      const storedUser: any = { id: 'u-1', roles: [] };
      const role: any = { id: 'r-1', name: 'admin', permissions: [{ code: 'PERM_A' }] };
      const savedUser = Object.assign(new UserEntity(), { id: 'u-1', roles: [role] });
      (userRepository.findOneById as jest.Mock).mockResolvedValue(storedUser);
      (roleService.findOne as jest.Mock).mockResolvedValue(role);
      (userRepository.save as jest.Mock).mockResolvedValue(savedUser);

      const result = await service.assignRole('u-1', { rolesIds: ['r-1'] });

      expect(result.roles).toEqual([role]);
      expect(roleService.findOne).toHaveBeenCalledWith('r-1');
    });

    it('calls refreshSessionPermissions after saving', async () => {
      const role: any = { id: 'r-1', name: 'admin', permissions: [{ code: 'PERM_A' }] };
      const savedUser = Object.assign(new UserEntity(), { id: 'u-1', roles: [role] });
      (userRepository.findOneById as jest.Mock).mockResolvedValue({ id: 'u-1', roles: [] });
      (roleService.findOne as jest.Mock).mockResolvedValue(role);
      (userRepository.save as jest.Mock).mockResolvedValue(savedUser);

      await service.assignRole('u-1', { rolesIds: ['r-1'] });

      expect(sessionService.refreshSessionPermissions).toHaveBeenCalledWith('u-1', ['PERM_A']);
    });
  });

  describe('findByEmail', () => {
    it('delegates to userRepository.findOneByEmail', async () => {
      const user = { id: 'u-1', email: 'test@example.com' } as UserEntity;
      (userRepository.findOneByEmail as jest.Mock).mockResolvedValue(user);

      await expect(service.findByEmail('test@example.com')).resolves.toEqual(user);
    });

    it('returns null when user not found', async () => {
      (userRepository.findOneByEmail as jest.Mock).mockResolvedValue(null);

      await expect(service.findByEmail('no@example.com')).resolves.toBeNull();
    });
  });
});

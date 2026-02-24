import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { UsersService } from 'src/services/users/users.service';
import { RolesService } from 'src/services/roles/roles.service';
import { PermissionsService } from 'src/services/permissions/permissions.service';
import { UserEntity } from 'src/entities/user.entity';
import { RoleEntity } from 'src/entities/role.entity';
import { PermissionEntity } from 'src/entities/permission.entity';
import { JwtService } from 'src/services/JWT/jwt.service';
import { EmailService } from 'src/clients/email/email.service';
import { IBackup, IMemoryDb, newDb } from 'pg-mem';
import { entities } from 'src/entities';
import { randomUUID } from 'crypto';
import { RedisService } from 'src/common/redis/redis.service';

describe('UsersService (integration)', () => {
  let moduleRef: TestingModule;
  let usersService: UsersService;
  let rolesService: RolesService;
  let permissionsService: PermissionsService;
  let userRepository: Repository<UserEntity>;
  let dataSource: DataSource;
  let db: IMemoryDb;
  let backup: IBackup;
  const request = { user: null } as any;
  let originalTtlEnv: string | undefined;

  const jwtServiceMock = {
    refreshToken: jest.fn(),
    generateToken: jest.fn(),
    getPayload: jest.fn(),
  };

  const emailServiceMock = {
    sendResetPasswordMail: jest.fn(),
    confirmPasswordChange: jest.fn(),
  };

  const redisServiceMock = {
    raw: {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue('OK'),
      sAdd: jest.fn().mockResolvedValue(1),
      pExpire: jest.fn().mockResolvedValue(true),
      del: jest.fn().mockResolvedValue(1),
      sRem: jest.fn().mockResolvedValue(1),
    },
  };

  beforeAll(async () => {
    originalTtlEnv = process.env.JWT_REFRESH_EXPIRES_IN;
    process.env.JWT_REFRESH_EXPIRES_IN = '1000';

    db = newDb();

    db.public.registerFunction({
      name: 'current_database',
      implementation: () => 'users_test'
    })

    db.public.registerFunction({
      name: 'version',
      implementation: () => 'PostgreSQL 17.6'
    })

    db.public.registerFunction({
      name: 'uuid_generate_v4',
      implementation: () => randomUUID()
    })

    db.public.registerFunction({
      name: 'gen_random_uuid',
      implementation: () => randomUUID()
    })

    dataSource = await db.adapters.createTypeormDataSource({
      type: 'postgres',
      entities: [...entities],
      synchronize: true
    })

    await dataSource.initialize()

    moduleRef = await Test.createTestingModule({
      imports: [],
      providers: [
        UsersService,
        RolesService,
        PermissionsService,
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
        {
          provide: EmailService,
          useValue: emailServiceMock,
        },
        {
          provide: RedisService,
          useValue: redisServiceMock,
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: dataSource.getRepository(UserEntity),
        },
        {
          provide: getRepositoryToken(RoleEntity),
          useValue: dataSource.getRepository(RoleEntity),
        },
        {
          provide: getRepositoryToken(PermissionEntity),
          useValue: dataSource.getRepository(PermissionEntity),
        },
        {
          provide: DataSource,
          useValue: dataSource,
        }
      ],
    }).compile();

    usersService = moduleRef.get(UsersService);
    rolesService = moduleRef.get(RolesService);
    permissionsService = moduleRef.get(PermissionsService);
    userRepository = moduleRef.get(getRepositoryToken(UserEntity));
    backup = db.backup();
  });

  afterAll(async () => {
    process.env.JWT_REFRESH_EXPIRES_IN = originalTtlEnv;
    await dataSource.destroy();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    Object.values(redisServiceMock.raw).forEach((fn: jest.Mock) => fn.mockClear());
    backup.restore();
  });

  it('registers a user and stores a hashed password', async () => {
    const response = await usersService.register({
      email: 'alice@example.com',
      password: 'P@ssword123',
      person_id: randomUUID(),
    }, request);

    expect(response).toEqual({ message: 'User alice@example.com created' });

    const stored = await userRepository.findOneBy({ email: 'alice@example.com' });
    expect(stored).toBeDefined();
    expect(stored?.password).toMatch(/^\$2[aby]\$.+/);
  });

  it('logs in a user, stores a session in redis and returns tokens', async () => {
    await usersService.register({ email: 'bob@example.com', password: 'Secret123', person_id: randomUUID() }, request);

    jwtServiceMock.generateToken.mockImplementation(async (_payload: any, type: string) => `${type}-token`);

    const httpRequest: any = {
      headers: {
        'user-agent': 'Mozilla/5.0',
        'x-forwarded-for': '203.0.113.5',
      },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };

    const tokens = await usersService.logIn({ email: 'bob@example.com', password: 'Secret123' }, httpRequest);

    expect(tokens).toEqual({
      accessToken: 'auth-token',
      refreshToken: 'refresh-token',
    });
    expect(jwtServiceMock.generateToken).toHaveBeenCalledTimes(2);
    expect(redisServiceMock.raw.set).toHaveBeenCalledWith(
      expect.stringMatching(/^auth_session:/),
      expect.any(String),
      { PX: 1000 },
    );
    const [indexKey] = redisServiceMock.raw.sAdd.mock.calls[0];
    expect(indexKey).toMatch(/^user_sessions:/);
  });

  it('assigns roles to a user and allows permission checks', async () => {
    await usersService.register({ email: 'carol@example.com', password: 'Secret123', person_id: randomUUID() }, request);
    const user = await userRepository.findOne({ where: { email: 'carol@example.com' } });
    expect(user).toBeDefined();

    const permission = await permissionsService.create({ code: 'USERS_ASSIGN' }, request);
    const role = await rolesService.create({ name: 'manager' }, request);
    await rolesService.assignPermissions(role.id, { permissionsIds: [permission.id] } as any);

    const updated = await usersService.assignRole(user!.id, { rolesIds: [role.id] });

    expect(updated.roles).toHaveLength(1);
    expect(updated.roles[0].name).toBe('manager');

    redisServiceMock.raw.get.mockResolvedValue(
      JSON.stringify({ active: true, permissions: ['USERS_ASSIGN'] }),
    );
    const canDo = await usersService.canDo(
      { id: updated.id, email: updated.email, person_id: updated.person_id, session_id: 'sess-1' } as any,
      'USERS_ASSIGN',
    );
    expect(canDo).toBe(true);
  });

  it('refreshes an active session and returns new tokens', async () => {
    await usersService.register({ email: 'frank@example.com', password: 'Secret123', person_id: randomUUID() }, request);
    const stored = await userRepository.findOneBy({ email: 'frank@example.com' });
    expect(stored).toBeDefined();

    jwtServiceMock.getPayload.mockResolvedValue({
      email: stored!.email,
      sid: 'sess-1',
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    redisServiceMock.raw.get.mockResolvedValue(
      JSON.stringify({ user_id: stored!.id, permissions: [], active: true }),
    );
    jwtServiceMock.refreshToken.mockResolvedValue({
      accessToken: 'next-access',
      refreshToken: 'next-refresh',
    });

    await expect(usersService.refreshToken('refresh-token')).resolves.toEqual({
      accessToken: 'next-access',
      refreshToken: 'next-refresh',
    });
    expect(redisServiceMock.raw.set).toHaveBeenCalledWith(
      'auth_session:sess-1',
      expect.stringContaining(`"user_id":"${stored!.id}"`),
      { KEEPTTL: true },
    );
    expect(jwtServiceMock.refreshToken).toHaveBeenCalledWith('refresh-token');
  });

  it('starts the forgot password flow and stores the generated token', async () => {
    await usersService.register({ email: 'dave@example.com', password: 'Secret123', person_id: randomUUID() }, request);
    jwtServiceMock.generateToken.mockResolvedValue('reset-token');
    emailServiceMock.sendResetPasswordMail.mockResolvedValue(undefined);

    const response = await usersService.forgotPassword({ email: 'dave@example.com' });
    expect(response).toEqual({
      message: 'If the email exists, a reset password link will be sent to it.',
    });
    expect(jwtServiceMock.generateToken).toHaveBeenCalledWith({ email: 'dave@example.com' }, 'resetPassword');
    expect(emailServiceMock.sendResetPasswordMail).toHaveBeenCalledWith('dave@example.com', 'reset-token');

    const stored = await userRepository.findOneBy({ email: 'dave@example.com' });
    expect(stored?.passResetToken).toBe('reset-token');
  });

  it('resets the password, clears the token, and notifies the user', async () => {
    await usersService.register({ email: 'erin@example.com', password: 'OldPassword1', person_id: randomUUID() }, request);
    jwtServiceMock.generateToken.mockResolvedValue('reset-token');
    emailServiceMock.sendResetPasswordMail.mockResolvedValue(undefined);
    await usersService.forgotPassword({ email: 'erin@example.com' });

    jwtServiceMock.getPayload.mockResolvedValue({
      email: 'erin@example.com',
      exp: Math.floor(Date.now() / 1000) + 300,
    } as any);
    emailServiceMock.confirmPasswordChange.mockResolvedValue(undefined);

    const response = await usersService.resetPassword('reset-token', { password: 'NewPassword1' });
    expect(response).toEqual({ message: 'Password reset successfully' });
    expect(emailServiceMock.confirmPasswordChange).toHaveBeenCalledWith('erin@example.com');

    const stored = await userRepository.findOneBy({ email: 'erin@example.com' });
    expect(stored?.passResetToken).toBeNull();
    expect(stored?.password).toMatch(/^\$2[aby]\$.+/);
    expect(stored?.password).not.toBe('NewPassword1');
  });
});

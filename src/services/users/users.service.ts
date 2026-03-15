import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { UserEntity, UserStatus } from 'src/entities/user.entity';
import { DataSource } from 'typeorm';
import { JwtService } from 'src/services/JWT/jwt.service';
import { RegisterUserDTO } from 'src/interfaces/DTO/register.dto';
import { compare } from 'bcrypt';
import { LoginDTO } from 'src/interfaces/DTO/login.dto';
import { AuthInterface } from 'src/interfaces/auth.interface';
import { AssignRoleDTO } from 'src/interfaces/DTO/assign.dto';
import { RolesService } from 'src/services/roles/roles.service';
import { ForgotPasswordDTO, ResetPasswordDTO } from 'src/interfaces/DTO/reset-password.dto';
import { EmailService } from 'src/clients/email/email.service';
import { RequestWithUser } from 'src/interfaces/request-user';
import { getTtlFromEnv } from 'src/common/tools/get-ttl';
import { Session } from 'src/interfaces/session.interface';
import { randomBytes, randomUUID } from 'crypto';
import { AuthUser } from 'src/interfaces/auth-user.interface';
import { RedisService } from 'src/common/redis/redis.service';
import type { Request } from 'express';
import { UAParser } from 'ua-parser-js';
import { getClientIp } from 'src/common/tools/get-client-ip';
import { ResetPasswordRedisPayload } from 'src/interfaces/payload';
import { UsersRepository } from 'src/services/users/users.repository';
import { ActivateUserDTO } from 'src/interfaces/DTO/activate.dto';
import { UsersErrorCodes, UsersException } from 'src/services/users/users.exception.handler';
import { SessionsService } from 'src/services/sessions/sessions.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly userRepository: UsersRepository,
    private readonly dataSource: DataSource,

    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
    private readonly roleService: RolesService,
    private readonly emailService: EmailService,
    private readonly sessionService: SessionsService,
  ) {}

  async refreshToken(refreshToken: string): Promise<AuthInterface> {
    const payload = await this.jwtService.getPayload(refreshToken, 'refresh');
    const cacheKey = `auth_session:${payload.sid}`;

    const raw = await this.redis.raw.get(cacheKey);
    const session = raw ? (JSON.parse(raw) as Session) : null;

    if (!session || !session.active) {
      throw new UsersException('Session expired or invalid', UsersErrorCodes.SESSION_INVALID, HttpStatus.UNAUTHORIZED);
    }

    const user = await this.findOne(session.user_id);

    const newSession: Session = {
      ...session,
      permissions: user.permissionCodes,
      last_refresh_at: new Date().toISOString(),
    };

    await this.redis.raw.set(cacheKey, JSON.stringify(newSession), {
      KEEPTTL: true,
    });

    return this.jwtService.refreshToken(refreshToken);
  }

  async canDo(user: AuthUser, permissionCode: string): Promise<boolean> {
    const cacheKey = `auth_session:${user.session_id}`;
    const raw = await this.redis.raw.get(cacheKey);
    const session = raw ? (JSON.parse(raw) as Session) : null;

    if (!session || !session.active) {
      throw new UsersException('Session expired or invalid', UsersErrorCodes.SESSION_INVALID, HttpStatus.UNAUTHORIZED);
    }

    const allowed = session.permissions.includes(permissionCode);

    if (!allowed) {
      throw new UsersException('Insufficient permissions', UsersErrorCodes.INSUFFICIENT_PERMISSIONS, HttpStatus.FORBIDDEN);
    }

    return allowed;
  }

  async register(dto: RegisterUserDTO, request: RequestWithUser): Promise<{ message: string }> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const password = randomBytes(12).toString('hex');
        const newUser = this.userRepository.create({
          ...dto,
          password,
          created_by: request.user,
        });
        const user = await this.userRepository.save(newUser, manager);
        await this.emailService.sendRegistrationMail(user.email, password);
        return { message: `User ${user.email} created` };
      });
    } catch (error) {
      throw new UsersException(
        'User registration failed',
        UsersErrorCodes.USER_NOT_REGISTERED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async logIn(body: LoginDTO, req: Request): Promise<AuthInterface> {
    const user = await this.findByEmail(body.email);
    if (!user) {
      throw new UsersException('Wrong email or password', UsersErrorCodes.WRONG_CREDENTIALS, HttpStatus.UNAUTHORIZED);
    }

    const isPasswordValid = await compare(body.password, user.password);
    if (!isPasswordValid) {
      throw new UsersException('Wrong email or password', UsersErrorCodes.WRONG_CREDENTIALS, HttpStatus.UNAUTHORIZED);
    }

    if (user.status == UserStatus.PENDING) {
      throw new UsersException(
        'This user has to finish their activation by changing the password',
        UsersErrorCodes.USER_NOT_INITIALIZED,
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (user.status == UserStatus.INACTIVE) {
      throw new UsersException('This user is not active', UsersErrorCodes.USER_INACTIVE, HttpStatus.UNAUTHORIZED);
    }

    try {
      const sessionId = randomUUID();
      const [accessToken, refreshToken] = await Promise.all([
        this.jwtService.generateToken({ email: user.email, sid: sessionId }, 'auth'),
        this.jwtService.generateToken({ email: user.email, sid: sessionId }, 'refresh'),
      ]);

      const requestData = this.getRequestData(req);

      const sessionData: Session = {
        user_id: user.id,
        person_id: user.person_id,
        email: user.email,
        permissions: user.permissionCodes,
        active: true,
        ip: requestData.ip,
        userAgent: requestData.userAgent,
        device: this.getDevice(requestData.userAgent),
        created_at: new Date().toISOString(),
        last_refresh_at: new Date().toISOString(),
      };

      const cacheKey = `auth_session:${sessionId}`;

      await this.redis.raw.set(cacheKey, JSON.stringify(sessionData), {
        PX: getTtlFromEnv('JWT_REFRESH_EXPIRES_IN'),
      });

      //Add user sessions index
      const userIndex = `user_sessions:${user.id}`;
      await this.redis.raw.sAdd(userIndex, sessionId);
      await this.redis.raw.pExpire(userIndex, getTtlFromEnv('JWT_REFRESH_EXPIRES_IN'));

      return {
        accessToken,
        refreshToken,
      };
    } catch (error) {
      throw new UsersException(
        'Unable to issue authentication tokens',
        UsersErrorCodes.TOKENS_ISSUE_ERROR,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async logOut(user: AuthUser): Promise<{ message: string }> {
    const cacheKey = `auth_session:${user.session_id}`;
    const userIndex = `user_sessions:${user.id}`;

    await this.redis.raw.del(cacheKey);
    await this.redis.raw.sRem(userIndex, user.session_id);
    return { message: 'Logged out successfully' };
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return await this.userRepository.findOneByEmail(email);
  }

  async assignRole(id: string, dto: AssignRoleDTO): Promise<UserEntity> {
    const user = await this.findOne(id);
    user.roles = await Promise.all(dto.rolesIds.map((roleId) => this.roleService.findOne(roleId)));
    const savedUser = await this.userRepository.save(user);
    try {
      await this.sessionService.refreshSessionPermissions(savedUser.id, savedUser.permissionCodes);
    } catch (error) {
      console.error('Error refreshing session permissions:', error);
    }
    return savedUser;
  }

  async forgotPassword(dto: ForgotPasswordDTO): Promise<{ message: string }> {
    const user = await this.findByEmail(dto.email);
    if (user) {
      const token = randomBytes(32).toString('hex');
      const redisIndex = `reset_password:${token}`;
      const redisPayload: ResetPasswordRedisPayload = { id: user.id };
      await this.redis.raw.set(redisIndex, JSON.stringify(redisPayload), {
        PX: getTtlFromEnv('RESET_PASSWORD_EXPIRES_IN'),
      });
      await this.emailService.sendResetPasswordMail(dto.email, token);
    }

    return {
      message: 'If the email exists, a reset password link will be sent to it.',
    };
  }

  async resetPassword(token: string, dto: ResetPasswordDTO): Promise<{ message: string }> {
    const redisIndex = `reset_password:${token}`;
    const raw = await this.redis.raw.get(redisIndex);
    const redisPayload = raw ? (JSON.parse(raw) as ResetPasswordRedisPayload) : null;
    if (!redisPayload) {
      throw new UsersException(
        'Invalid or expired reset password token',
        UsersErrorCodes.RESET_PASSWORD_INVALID,
        HttpStatus.UNAUTHORIZED,
      );
    }

    let user: UserEntity;
    try {
      user = await this.findOne(redisPayload.id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new UsersException(
          'Invalid or expired reset password token',
          UsersErrorCodes.RESET_PASSWORD_USER_NOT_FOUND,
          HttpStatus.UNAUTHORIZED,
        );
      }
      throw error;
    }

    user.password = dto.password;
    await this.userRepository.save(user);
    await this.redis.raw.del(redisIndex);
    await this.emailService.confirmPasswordChange(user.email);
    return { message: 'Password reset successfully' };
  }

  async firstActivation(dto: ActivateUserDTO): Promise<{ message: string }> {
    const user = await this.findByEmail(dto.email);
    if (!user) {
      throw new UsersException('User not found', UsersErrorCodes.USER_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    if (user.status != UserStatus.PENDING) {
      throw new UsersException(
        'User has already been activated',
        UsersErrorCodes.USER_ALREADY_ACTIVE,
        HttpStatus.BAD_REQUEST,
      );
    }
    const isPasswordValid = await compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UsersException('Wrong email or password', UsersErrorCodes.WRONG_CREDENTIALS, HttpStatus.UNAUTHORIZED);
    }
    user.password = dto.new_password;
    user.status = UserStatus.ACTIVE;
    await this.userRepository.save(user);
    return { message: 'User activated successfully' };
  }

  async activate(id: string): Promise<{ message: string }> {
    const user = await this.findOne(id);
    if (user.status != UserStatus.INACTIVE) {
      throw new UsersException(
        `User must be ${UserStatus.INACTIVE} to be activated, but current status is ${user.status}`,
        UsersErrorCodes.USER_ALREADY_ACTIVE,
        HttpStatus.BAD_REQUEST,
      );
    }
    user.status = UserStatus.ACTIVE;
    await this.userRepository.save(user);
    return { message: 'User activated successfully' };
  }

  async deactivate(id: string): Promise<{ message: string }> {
    const user = await this.findOne(id);
    if (user.status != UserStatus.ACTIVE) {
      throw new UsersException(
        `User must be ${UserStatus.ACTIVE} to be deactivated, but current status is ${user.status}`,
        UsersErrorCodes.USER_ALREADY_INACTIVE,
        HttpStatus.BAD_REQUEST,
      );
    }
    user.status = UserStatus.INACTIVE;
    await this.userRepository.save(user);
    return { message: 'User deactivated successfully' };
  }

  async findAll(): Promise<UserEntity[]> {
    return await this.userRepository.findAll();
  }

  private async findOne(id: string): Promise<UserEntity> {
    const user = await this.userRepository.findOneById(id);
    if (!user) throw new UsersException('User not found', UsersErrorCodes.USER_NOT_FOUND, HttpStatus.NOT_FOUND);
    return user;
  }

  private getRequestData(req: Request) {
    const ip = getClientIp(req);

    const userAgent = req.headers['user-agent'] || 'unknown';

    return { ip, userAgent };
  }

  private getDevice(userAgent: string): string {
    const parser = new UAParser(userAgent);
    const ua = parser.getResult();

    return `${ua.os.name ?? 'Unknown OS'} - ${ua.browser.name ?? 'Unknown Browser'}`;
  }
}

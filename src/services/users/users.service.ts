import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from 'src/entities/user.entity';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from 'src/services/JWT/jwt.service';
import { RegisterUserDTO } from 'src/interfaces/DTO/register.dto';
import { compare } from 'bcrypt';
import { LoginDTO } from 'src/interfaces/DTO/login.dto';
import { AuthInterface } from 'src/interfaces/auth.interface';
import { AssignRoleDTO } from 'src/interfaces/DTO/assign.dto';
import { RolesService } from 'src/services/roles/roles.service';
import {
  ForgotPasswordDTO,
  ResetPasswordDTO,
} from 'src/interfaces/DTO/reset-password.dto';
import { EmailService } from 'src/clients/email/email.service';
import { RequestWithUser } from 'src/interfaces/request-user';
import { getTtlFromEnv } from 'src/common/tools/get-ttl';
import { Session } from 'src/interfaces/session.interface';
import { randomUUID } from 'crypto';
import { AuthUser } from 'src/interfaces/auth-user.interface';
import { RedisService } from 'src/common/redis/redis.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,

    @InjectDataSource()
    private readonly dataSource: DataSource,

    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
    private readonly roleService: RolesService,
    private readonly emailService: EmailService,
  ) {}

  async refreshToken(refreshToken: string): Promise<AuthInterface> {
    const payload = await this.jwtService.getPayload(refreshToken, 'refresh');
    const cacheKey = `auth_session:${payload.sid}`;

    const raw = await this.redis.raw.get(cacheKey);
    const session = raw ? JSON.parse(raw) as Session : null;

    if(!session || !session.active) {
      throw new UnauthorizedException({
        message: 'Session expired or invalid',
        code: 'SESSION_INVALID',
        statusCode: 401,
      });
    }

    const user = await this.findOne(session.user_id)

    const newSession: Session = {
      ... session,
      permissions: user.permissionCodes,
    }

    await this.redis.raw.set(cacheKey, JSON.stringify(newSession), {KEEPTTL: true})

    return this.jwtService.refreshToken(refreshToken);
  }

  async canDo(user: AuthUser, permissionCode: string): Promise<boolean> {
    const cacheKey = `auth_session:${user.session_id}`;
    const raw = await this.redis.raw.get(cacheKey);
    const session = raw ? JSON.parse(raw) as Session : null;

    if(!session || !session.active) {
      throw new UnauthorizedException('Session expired or invalid');
    }

    const allowed = session.permissions.includes(permissionCode);

    if(!allowed) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return allowed;
  }

  async register(
    dto: RegisterUserDTO,
    request: RequestWithUser,
  ): Promise<{ message: string }> {
    return this.dataSource.transaction(async (manager) => {
      const transactionalRepository = manager.getRepository(UserEntity);
      const user = await transactionalRepository.save(
        transactionalRepository.create({
          ...dto,
          created_by: request.user,
        }),
      );
      return { message: `User ${user.email} created` };
    });
  }

  async logIn(body: LoginDTO): Promise<AuthInterface> {
    const user = await this.findByEmail(body.email);
    if (!user) {
      throw new UnauthorizedException('Wrong email or password');
    }

    if (!user.active) {
      throw new UnauthorizedException('This user is not active');
    }

    const isPasswordValid = await compare(body.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Wrong email or password');
    }

    try {
      const sessionId = randomUUID()
      const [accessToken, refreshToken] = await Promise.all([
        this.jwtService.generateToken({ email: user.email, sid: sessionId }, 'auth'),
        this.jwtService.generateToken({ email: user.email, sid: sessionId }, 'refresh'),
      ]);

      const sessionData: Session = {
        user_id: user.id,
        person_id: user.person_id,
        email: user.email,
        permissions: user.permissionCodes,
        active: true
      };

      const cacheKey = `auth_session:${sessionId}`;

      await this.redis.raw.set(
        cacheKey,
        JSON.stringify(sessionData),
        { PX: getTtlFromEnv('JWT_REFRESH_EXPIRES_IN')}
      );


      //Add user sessions index
      const userIndex = `user_sessions:${user.id}`;
      await this.redis.raw.sAdd(userIndex, sessionId);
      await this.redis.raw.pExpire(
        userIndex,
        getTtlFromEnv('JWT_REFRESH_EXPIRES_IN'),
      );

      return {
        accessToken,
        refreshToken,
      };
    } catch (error) {
      console.error(error)
      throw new InternalServerErrorException(
        'Unable to issue authentication tokens',
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
    return this.userRepository.findOne({ where: { email } });
  }

  async assignRole(id: string, dto: AssignRoleDTO): Promise<UserEntity> {
    const user = await this.findOne(id);
    user.roles = await Promise.all(
      dto.rolesIds.map((roleId) => this.roleService.findOne(roleId)),
    );
    return this.userRepository.save(user);
  }

  async forgotPassword(dto: ForgotPasswordDTO): Promise<{ message: string }> {
    const user = await this.findByEmail(dto.email);
    if (user) {
      const token = await this.jwtService.generateToken(
        { email: dto.email },
        'resetPassword',
      );
      user.passResetToken = token;
      await this.userRepository.save(user);
      await this.emailService.sendResetPasswordMail(dto.email, token);
    }

    return {
      message: 'If the email exists, a reset password link will be sent to it.',
    };
  }

  async resetPassword(
    token: string,
    dto: ResetPasswordDTO,
  ): Promise<{ message: string }> {
    const payload = await this.jwtService.getPayload(token, 'resetPassword');
    const user = await this.findByEmail(payload.email);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (user.passResetToken != token) {
      throw new ForbiddenException('Password already changed');
    }

    user.password = dto.password;
    user.passResetToken = null;
    await this.userRepository.save(user);
    await this.emailService.confirmPasswordChange(user.email);
    return { message: 'Password reset successfully' };
  }

  async findAll(): Promise<UserEntity[]> {
    return this.userRepository.find({ relations: ['roles'] });
  }

  private async findOne(id: string): Promise<UserEntity> {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}

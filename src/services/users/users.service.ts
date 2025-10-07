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
import { UserI } from 'src/interfaces/user.interface';
import { compare } from 'bcrypt';
import { LoginDTO } from 'src/interfaces/DTO/login.dto';
import { AuthInterface } from 'src/interfaces/auth.interface';
import { AssignRoleDTO } from 'src/interfaces/DTO/assign.dto';
import { RolesService } from 'src/services/roles/roles.service';
import {
  ForgotPasswordDTO,
  ResetPasswordDTO,
} from 'src/interfaces/DTO/reset-password.dto';
import { EmailService } from 'src/services/email/email.service';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(UserEntity)
        private readonly userRepository: Repository<UserEntity>,

        @InjectDataSource()
        private readonly dataSource: DataSource,

        private readonly jwtService: JwtService,
        private readonly roleService: RolesService,
        private readonly emailService: EmailService,
    ) {}

    async refreshToken(refreshToken: string): Promise<AuthInterface> {
        return this.jwtService.refreshToken(refreshToken);
    }

    async canDo(user: UserI, permissionCode: string): Promise<boolean> {
        const result = user.permissionCodes.includes(permissionCode);
        if (!result) {
            throw new UnauthorizedException('You do not have permission to perform this action');
        }
        return result;
    }

    async register(dto: RegisterUserDTO): Promise<{ message: string }> {
        return this.dataSource.transaction(async manager => {
            const transactionalRepository = manager.getRepository(UserEntity);
            const user = await transactionalRepository.save(transactionalRepository.create(dto));
            return {message: `User ${user.email} created`};
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
            const [accessToken, refreshToken] = await Promise.all([
                this.jwtService.generateToken({ email: user.email }, 'auth'),
                this.jwtService.generateToken({ email: user.email }, 'refresh'),
            ]);

            return {
                accessToken,
                refreshToken,
            };
        } catch (error) {
            throw new InternalServerErrorException('Unable to issue authentication tokens');
        }
    }

    async findByEmail(email: string): Promise<UserEntity | null> {
        return this.userRepository.findOne({ where: { email } });
    }

    async assignRole(id: number, dto: AssignRoleDTO): Promise<UserEntity> {
        const user = await this.findOne(id);
        user.roles = await Promise.all(dto.rolesIds.map(roleId => this.roleService.findOne(roleId)));
        return this.userRepository.save(user);
    }
    
    async forgotPassword(dto: ForgotPasswordDTO): Promise<{ message: string }> {
      const user = await this.findByEmail(dto.email);
      if (user) {
        const token = await this.jwtService.generateToken({email: dto.email},'resetPassword')
        user.passResetToken = token
        await this.userRepository.save(user)
        await this.emailService.sendResetPasswordMail(dto.email, token);
      }
      
      return {message: 'If the email exists, a reset password link will be sent to it.'}
    }
    
    async resetPassword(token: string, dto: ResetPasswordDTO): Promise<{ message: string }> {
      const payload = await this.jwtService.getPayload(token, 'resetPassword');
      const user = await this.findByEmail(payload.email);
      if (!user) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      if (user.passResetToken!=token) {
        throw new ForbiddenException('Password already changed')
      }

      user.password = dto.password;
      user.passResetToken = null;
      await this.userRepository.save(user);
      return {message: 'Password reset successfully'}
    }

    private async findOne(id: number): Promise<UserEntity> {
        const user = await this.userRepository.findOneBy({ id });
        if (!user) throw new NotFoundException('User not found');
        return user;
    }
}

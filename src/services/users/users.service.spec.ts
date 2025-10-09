import { ForbiddenException, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { UsersService } from './users.service';
import { JwtService } from '../JWT/jwt.service';
import { RolesService } from '../roles/roles.service';
import { EmailService } from 'src/clients/email/email.service';
import { UserEntity } from 'src/entities/user.entity';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

import { compare } from 'bcrypt';

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: jest.Mocked<Partial<Repository<UserEntity>>>;
  let dataSource: jest.Mocked<Partial<DataSource>>;
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

    service = new UsersService(
      userRepository as any,
      dataSource as any,
      jwtService as any,
      roleService as any,
      emailService as any,
    );
  });

  describe('canDo', () => {
    it('returns true when permission exists', async () => {
      const user: any = { permissionCodes: ['CREATE_USER', 'EDIT_USER'] };
      await expect(service.canDo(user, 'EDIT_USER')).resolves.toBe(true);
    });

    it('throws UnauthorizedException when permission missing', async () => {
      const user: any = { permissionCodes: [] };
      await expect(service.canDo(user, 'DELETE_USER')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logIn', () => {
    const activeUser: UserEntity = Object.assign(new UserEntity(), {
      email: 'john@example.com',
      password: 'hashed-password',
      active: true,
    });

    it('issues access and refresh tokens on success', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue(activeUser);
      (compare as jest.Mock).mockResolvedValue(true);
      (jwtService.generateToken as jest.Mock)
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      await expect(service.logIn({ email: 'john@example.com', password: 'secret' })).resolves.toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('throws UnauthorizedException when user not found', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.logIn({ email: 'john@example.com', password: 'secret' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when user inactive', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue({ ...activeUser, active: false });

      await expect(service.logIn({ email: 'john@example.com', password: 'secret' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when password comparison fails', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue(activeUser);
      (compare as jest.Mock).mockResolvedValue(false);

      await expect(service.logIn({ email: 'john@example.com', password: 'wrong' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws InternalServerErrorException if token generation fails', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue(activeUser);
      (compare as jest.Mock).mockResolvedValue(true);
      (jwtService.generateToken as jest.Mock).mockRejectedValue(new Error('sign error'));

      await expect(service.logIn({ email: 'john@example.com', password: 'secret' })).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('forgotPassword', () => {
    it('stores reset token and sends email when user exists', async () => {
      const storedUser: any = { email: 'user@example.com', passResetToken: null };
      (userRepository.findOne as jest.Mock).mockResolvedValue(storedUser);
      (jwtService.generateToken as jest.Mock).mockResolvedValue('reset-token');

      await expect(service.forgotPassword({ email: 'user@example.com' })).resolves.toEqual({
        message: expect.any(String),
      });

      expect(jwtService.generateToken).toHaveBeenCalledWith({ email: 'user@example.com' }, 'resetPassword');
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'user@example.com', passResetToken: 'reset-token' }),
      );
      expect(emailService.sendResetPasswordMail).toHaveBeenCalledWith('user@example.com', 'reset-token');
    });

    it('returns success message without side effects when user missing', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.forgotPassword({ email: 'missing@example.com' })).resolves.toEqual({
        message: expect.any(String),
      });

      expect(jwtService.generateToken).not.toHaveBeenCalled();
      expect(userRepository.save).not.toHaveBeenCalled();
      expect(emailService.sendResetPasswordMail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('updates password and clears token when payload valid', async () => {
      (jwtService.getPayload as jest.Mock).mockResolvedValue({ email: 'user@example.com', exp: 123 });
      const storedUser: any = { email: 'user@example.com', passResetToken: 'token-123' };
      (userRepository.findOne as jest.Mock).mockResolvedValue(storedUser);

      await expect(service.resetPassword('token-123', { password: 'new-password' })).resolves.toEqual({
        message: 'Password reset successfully',
      });

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'user@example.com', password: 'new-password', passResetToken: null }),
      );
      expect(emailService.confirmPasswordChange).toHaveBeenCalledWith('user@example.com');
    });

    it('throws UnauthorizedException when user missing', async () => {
      (jwtService.getPayload as jest.Mock).mockResolvedValue({ email: 'missing@example.com', exp: 1 });
      (userRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.resetPassword('token', { password: 'new' })).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws ForbiddenException when stored token differs', async () => {
      (jwtService.getPayload as jest.Mock).mockResolvedValue({ email: 'user@example.com', exp: 1 });
      (userRepository.findOne as jest.Mock).mockResolvedValue({ email: 'user@example.com', passResetToken: 'other' });

      await expect(service.resetPassword('token', { password: 'new' })).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('refreshToken', () => {
    it('delegates to jwtService', async () => {
      (jwtService.refreshToken as jest.Mock).mockResolvedValue({ accessToken: 'a', refreshToken: 'b' });
      await expect(service.refreshToken('refresh-token')).resolves.toEqual({ accessToken: 'a', refreshToken: 'b' });
    });
  });
});

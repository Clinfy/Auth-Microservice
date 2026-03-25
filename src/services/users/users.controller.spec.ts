import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { RegisterUserDTO } from 'src/interfaces/DTO/register.dto';
import { LoginDTO } from 'src/interfaces/DTO/login.dto';
import { AuthInterface } from 'src/interfaces/auth.interface';
import { AssignRoleDTO } from 'src/interfaces/DTO/assign.dto';
import { ForgotPasswordDTO, ResetPasswordDTO } from 'src/interfaces/DTO/reset-password.dto';
import { ActivateUserDTO } from 'src/interfaces/DTO/activate.dto';
import { PaginatedResponseDto, PaginationQueryDto } from 'src/interfaces/DTO/pagination.dto';
import { UserEntity } from 'src/entities/user.entity';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;
  const userId = '11111111-1111-1111-1111-111111111111';
  const roleIdA = '22222222-2222-2222-2222-222222222222';
  const roleIdB = '33333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    process.env.JWT_AUTH_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';

    service = {
      register: jest.fn(),
      logIn: jest.fn(),
      logOut: jest.fn(),
      refreshToken: jest.fn(),
      canDo: jest.fn(),
      assignRole: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      firstActivation: jest.fn(),
      activate: jest.fn(),
      deactivate: jest.fn(),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    controller = new UsersController(service);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should register a user', async () => {
    const dto: RegisterUserDTO = {
      email: 'user@example.com',
      person_id: '55555555-5555-5555-5555-555555555555',
    };
    const response = { message: 'User user@example.com created' };
    service.register.mockResolvedValue(response);
    const request = {
      user: { id: '44444444-4444-4444-4444-444444444444' },
    } as any;

    await expect(controller.register(request, dto)).resolves.toEqual(response);
    expect(service.register).toHaveBeenCalledWith(dto, request);
  });

  it('should log in a user and set cookies', async () => {
    const dto: LoginDTO = { email: 'user@example.com', password: 'secret' };
    const tokens: AuthInterface = {
      accessToken: 'access',
      refreshToken: 'refresh',
    };
    service.logIn.mockResolvedValue(tokens);
    const request = { ip: '127.0.0.1' } as any;
    const response = { cookie: jest.fn() } as any;

    await expect(controller.logIn(dto, request, response)).resolves.toEqual({ message: 'Login successful' });
    expect(service.logIn).toHaveBeenCalledWith(dto, request);
    expect(response.cookie).toHaveBeenCalledWith('auth_token', 'access', expect.any(Object));
    expect(response.cookie).toHaveBeenCalledWith('refresh_token', 'refresh', expect.any(Object));
  });

  it('should refresh a token using the cookie', async () => {
    const auth: AuthInterface = {
      accessToken: 'newAccess',
      refreshToken: 'newRefresh',
    };
    service.refreshToken.mockResolvedValue(auth);
    const request = {
      cookies: { refresh_token: 'refresh-token-value' },
    } as any;
    const response = { cookie: jest.fn() } as any;

    await expect(controller.refreshToken(request, response)).resolves.toEqual({ message: 'Token refreshed' });
    expect(service.refreshToken).toHaveBeenCalledWith('refresh-token-value');
    expect(response.cookie).toHaveBeenCalledWith('auth_token', 'newAccess', expect.any(Object));
    expect(response.cookie).toHaveBeenCalledWith('refresh_token', 'newRefresh', expect.any(Object));
  });

  it('should check if the user can perform an action', async () => {
    const user = { email: 'user@example.com' } as any;
    const request = { user } as any;
    service.canDo.mockResolvedValue(true);

    await expect(controller.canDo(request, 'PERMISSION_CODE')).resolves.toBe(true);
    expect(service.canDo).toHaveBeenCalledWith(user, 'PERMISSION_CODE');
  });

  it('should return the logged user details', async () => {
    const request = {
      user: {
        id: userId,
        email: 'user@example.com',
        person_id: '66666666-6666-6666-6666-666666666666',
        session_id: 'abcd',
      },
    } as any;

    expect(controller.me(request)).toEqual({
      id: userId,
      email: 'user@example.com',
      person_id: '66666666-6666-6666-6666-666666666666',
      session_id: 'abcd',
    });
  });

  it('should return all users as a paginated response', async () => {
    const users = [
      {
        id: userId,
        email: 'user@example.com',
        person_id: '77777777-7777-7777-7777-777777777777',
      },
    ] as UserEntity[];
    const query = new PaginationQueryDto();
    const paginated = new PaginatedResponseDto(users, 1, query.page, query.limit);
    service.findAll.mockResolvedValue(paginated);

    const result = await controller.findAll(query);
    expect(result.data).toEqual(users);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.totalPages).toBe(1);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('should assign roles to the user', async () => {
    const dto: AssignRoleDTO = { rolesIds: [roleIdA, roleIdB] };
    const updatedUser = { id: userId } as any;
    service.assignRole.mockResolvedValue(updatedUser);

    await expect(controller.assignRole(userId, dto)).resolves.toEqual(updatedUser);
    expect(service.assignRole).toHaveBeenCalledWith(userId, dto);
  });

  it('should trigger forgot password flow', async () => {
    const dto: ForgotPasswordDTO = { email: 'user@example.com' };
    const response = {
      message: 'If the email exists, a reset password link will be sent to it.',
    };
    service.forgotPassword.mockResolvedValue(response);

    await expect(controller.forgotPassword(dto)).resolves.toEqual(response);
    expect(service.forgotPassword).toHaveBeenCalledWith(dto);
  });

  it('should reset the user password', async () => {
    const dto: ResetPasswordDTO = { password: 'newPassword' };
    const response = { message: 'Password reset successfully' };
    service.resetPassword.mockResolvedValue(response);

    await expect(controller.resetPassword('token-123', dto)).resolves.toEqual(response);
    expect(service.resetPassword).toHaveBeenCalledWith('token-123', dto);
  });

  it('should log out a user and clear cookies', async () => {
    const user = {
      id: userId,
      email: 'user@example.com',
      person_id: '66666666-6666-6666-6666-666666666666',
      session_id: 'abcd',
    };
    const request = { user } as any;
    const serviceResponse = { message: 'Logged out successfully' };
    service.logOut.mockResolvedValue(serviceResponse);
    const response = { clearCookie: jest.fn() } as any;

    await expect(controller.logOut(request, response)).resolves.toEqual(serviceResponse);
    expect(service.logOut).toHaveBeenCalledWith(user);
    expect(response.clearCookie).toHaveBeenCalledWith('auth_token', { path: '/' });
    expect(response.clearCookie).toHaveBeenCalledWith('refresh_token', { path: '/users/refresh-token' });
  });

  it('should activate a user for the first time', async () => {
    const dto: ActivateUserDTO = {
      email: 'user@example.com',
      password: 'TempPass1!',
      new_password: 'N3wP@ssw0rd!',
    };
    const response = { message: 'User activated successfully' };
    service.firstActivation.mockResolvedValue(response);

    await expect(controller.firstActivation(dto)).resolves.toEqual(response);
    expect(service.firstActivation).toHaveBeenCalledWith(dto);
  });

  it('should activate a user', async () => {
    const response = { message: 'User activated successfully' };
    service.activate.mockResolvedValue(response);

    await expect(controller.activate(userId)).resolves.toEqual(response);
    expect(service.activate).toHaveBeenCalledWith(userId);
  });

  it('should deactivate a user', async () => {
    const response = { message: 'User deactivated successfully' };
    service.deactivate.mockResolvedValue(response);

    await expect(controller.deactivate(userId)).resolves.toEqual(response);
    expect(service.deactivate).toHaveBeenCalledWith(userId);
  });
});

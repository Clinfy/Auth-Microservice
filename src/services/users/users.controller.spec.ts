import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { RegisterUserDTO } from 'src/interfaces/DTO/register.dto';
import { LoginDTO } from 'src/interfaces/DTO/login.dto';
import { AuthInterface } from 'src/interfaces/auth.interface';
import { AssignRoleDTO } from 'src/interfaces/DTO/assign.dto';
import { ForgotPasswordDTO, ResetPasswordDTO } from 'src/interfaces/DTO/reset-password.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;
  const userId = '11111111-1111-1111-1111-111111111111';
  const roleIdA = '22222222-2222-2222-2222-222222222222';
  const roleIdB = '33333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    service = {
      register: jest.fn(),
      logIn: jest.fn(),
      refreshToken: jest.fn(),
      canDo: jest.fn(),
      assignRole: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    controller = new UsersController(service);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should register a user', async () => {
    const dto: RegisterUserDTO = { email: 'user@example.com', password: 'secret', person_id: '55555555-5555-5555-5555-555555555555' };
    const response = { message: 'User user@example.com created' };
    service.register.mockResolvedValue(response);
    const request = { user: { id: '44444444-4444-4444-4444-444444444444' } } as any;

    await expect(controller.register(request, dto)).resolves.toEqual(response);
    expect(service.register).toHaveBeenCalledWith(dto, request);
  });

  it('should log in a user', async () => {
    const dto: LoginDTO = { email: 'user@example.com', password: 'secret' };
    const tokens: AuthInterface = { accessToken: 'access', refreshToken: 'refresh' };
    service.logIn.mockResolvedValue(tokens);

    await expect(controller.logIn(dto)).resolves.toEqual(tokens);
    expect(service.logIn).toHaveBeenCalledWith(dto);
  });

  it('should refresh a token using the header', async () => {
    const auth: AuthInterface = { accessToken: 'newAccess', refreshToken: 'newRefresh' };
    service.refreshToken.mockResolvedValue(auth);
    const request = { headers: { 'refresh-token': 'refresh-token-value' } } as any;

    await expect(controller.refreshToken(request)).resolves.toEqual(auth);
    expect(service.refreshToken).toHaveBeenCalledWith('refresh-token-value');
  });

  it('should check if the user can perform an action', async () => {
    const user = { email: 'user@example.com' } as any;
    const request = { user } as any;
    service.canDo.mockResolvedValue(true);

    await expect(controller.canDo(request, 'PERMISSION_CODE')).resolves.toBe(true);
    expect(service.canDo).toHaveBeenCalledWith(user, 'PERMISSION_CODE');
  });

  it('should return the logged user details', async () => {
    const request = { user: { id: userId, email: 'user@example.com', person_id: '66666666-6666-6666-6666-666666666666' } } as any;

    expect(controller.me(request)).toEqual({ id: userId, email: 'user@example.com', person_id: '66666666-6666-6666-6666-666666666666' });
  });

  it('should return all users', async () => {
    const users = [{ id: userId, email: 'user@example.com', person_id: '77777777-7777-7777-7777-777777777777' }] as any;
    service.findAll.mockResolvedValue(users);

    await expect(controller.findAll()).resolves.toEqual(users);
    expect(service.findAll).toHaveBeenCalledTimes(1);
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
    const response = { message: 'If the email exists, a reset password link will be sent to it.' };
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
});

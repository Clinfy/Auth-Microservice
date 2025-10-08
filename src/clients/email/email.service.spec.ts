import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { TemplateService } from './template.service';

jest.mock('axios', () => ({ post: jest.fn() }));

const propagateMock = jest.fn();
jest.mock('../../common/tools/propagate-axios-error', () => ({
  propagateAxiosError: (error: unknown) => propagateMock(error),
}));

describe('EmailService', () => {
  let config: jest.Mocked<ConfigService>;
  let template: jest.Mocked<TemplateService>;
  let service: EmailService;
  let consoleErrorSpy: jest.SpyInstance;
  const axiosPost = axios.post as jest.Mock;

  beforeEach(() => {
    axiosPost.mockReset();
    propagateMock.mockReset();

    config = {
      get: jest.fn((key: string) => {
        const map: Record<string, any> = {
          APP_NAME: 'AuthApp',
          FRONTEND_URL: 'https://front.example',
          EMAIL_API_URL: 'https://mailer.example',
          EMAIL_API_KEY: 'secret',
          JWT_RESET_PASSWORD_EXPIRES_IN: 7,
        };
        return map[key];
      }),
    } as any;

    template = {
      loadTemplate: jest.fn().mockResolvedValue('<tpl/>'),
      render: jest.fn().mockReturnValue('<html/>'),
    } as any;

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    service = new EmailService(config, template);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('sends reset password mail with rendered template', async () => {
    axiosPost.mockResolvedValue({ status: 200 });

    await service.sendResetPasswordMail('user@example.com', 'token123');

    expect(template.loadTemplate).toHaveBeenCalledWith('send-reset.template.html');
    expect(template.render).toHaveBeenCalledWith('<tpl/>', expect.objectContaining({
      APP_NAME: 'AuthApp',
      RESET_URL: 'https://front.example/reset-password?token=token123',
      USER_NAME_PREFIX: 'user',
      EXPIRES_MINUTES: 7,
    }));

    expect(axiosPost).toHaveBeenCalledWith(
      'https://mailer.example/email/send',
      expect.objectContaining({
        recipient: ['user@example.com'],
        subject: expect.stringContaining('AuthApp'),
        html: '<html/>',
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-api-key': 'secret' }),
      }),
    );
  });

  it('sends password change confirmation email', async () => {
    axiosPost.mockResolvedValue({ status: 200 });

    await service.confirmPasswordChange('user@example.com');

    expect(template.loadTemplate).toHaveBeenCalledWith('confirm-reset.template.html');
    expect(axiosPost).toHaveBeenCalled();
  });

  it('propagates axios errors via propagateAxiosError', async () => {
    const error = new Error('boom');
    axiosPost.mockRejectedValue(error);
    propagateMock.mockImplementation(() => {
      throw new Error('propagated');
    });

    await expect(service.sendResetPasswordMail('user@example.com', 'token123')).rejects.toThrow('propagated');
    expect(propagateMock).toHaveBeenCalledWith(error);
  });
});

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailBody } from 'src/interfaces/clients/email-body.interface';
import { TemplateService } from 'src/clients/email/template.service';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class EmailService {
  constructor(
    private readonly configService: ConfigService,
    private readonly templateService: TemplateService,

    @Inject('EMAIL_SERVICE')
    private readonly emailClient: ClientProxy,
  ) {}

  async sendResetPasswordMail(email: string, token: string) {
    const data = {
      APP_NAME: this.configService.get('APP_NAME'),
      APP_URL: this.configService.get('FRONTEND_URL'),
      RESET_URL: `${this.configService.get('FRONTEND_URL')}/reset-password?token=${token}`,
      EXPIRES_MINUTES: this.configService.get('JWT_RESET_PASSWORD_EXPIRES_IN') ?? 5,
      YEAR: String(new Date().getFullYear()),
      USER_NAME_PREFIX: email.split("@")[0]
    }

    const recipient = [email];

    const subject = `Reset Password of your ${data.APP_NAME} Account`;
    const text = `Click the link below to reset your ${data.APP_NAME} password: \n ${data.RESET_URL} \n this link will expire in 5 minutes`;

    const template = await this.templateService.loadTemplate("send-reset.template.html")
    const html = this.templateService.render(template,data)

    await this.sendMail({recipient,subject,html,text});
  }

  async confirmPasswordChange(email:string) {
    const data = {
      APP_NAME: this.configService.get('APP_NAME'),
      YEAR: String(new Date().getFullYear()),
      USER_NAME_PREFIX: email.split("@")[0]
    }

    const recipient = [email];
    const subject = `Your password of ${data.APP_NAME} has been changed`;
    const text  = "Your account password has been changed. If this was you, you can ignore this message; otherwise, please contact us.";

    const template = await this.templateService.loadTemplate("confirm-reset.template.html");
    const html = this.templateService.render(template,data);

    await this.sendMail({recipient,subject,html,text});
  }

  private async sendMail(body: EmailBody) {

    try {
      this.emailClient.emit('email_queue', body);
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }
}
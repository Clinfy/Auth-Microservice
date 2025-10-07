import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { EmailBody } from 'src/interfaces/clients/email-body.interface';
import { propagateAxiosError } from 'src/common/tools/propagate-axios-error';
import { TemplateService } from 'src/clients/email/template.service';

@Injectable()
export class EmailService {
  constructor(
    private readonly configService: ConfigService,
    private readonly templateService: TemplateService
  ) {}

  async sendResetPasswordMail(email: string, token: string) {
    const data = {
      APP_NAME: this.configService.get('APP_NAME'),
      APP_URL: this.configService.get('FRONTEND_URL'),
      RESET_URL: `${this.configService.get('FRONTEND_URL')}/reset-password?token=${token}`,
      EXPIRES_MINUTES: 5,
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
    const recipient = [email];
    const subject = 'Your password has been changed';
    const html = `The password of your Clinfy account has been changed, if was you, ignore this message, if is not the case contact us`;
    await this.sendMail({recipient,subject,html});
  }

  private async sendMail(body: EmailBody) {

    await axios.post(`${this.configService.get('EMAIL_API_URL')}/email/send`, {
      recipient: body.recipient,
      subject: body.subject,
      html: body.html,
      text: body.text
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.configService.get('EMAIL_API_KEY'),
      },
    }).catch(error => {
      console.error('Error sending email:', error);
      propagateAxiosError(error);
    })
  }
}
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { EmailBody } from 'src/interfaces/clients/email-body.interface';
import { propagateAxiosError } from 'src/common/tools/propagate-axios-error';

@Injectable()
export class EmailService {
  constructor(
    private readonly configService: ConfigService,
  ) {}

  async sendResetPasswordMail(email: string, token: string) {

    const resetPasswordUrl = `${this.configService.get('FRONTEND_URL')}/reset-password?token=${token}`;

    const recipient = [email];
    const subject = 'Reset Password of your Clinfy Account';
    const html = `Click the link below to reset your Clinfy password: ${resetPasswordUrl} \nthis link will expire in 5 minutes`;

    await this.sendMail({recipient,subject,html});
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
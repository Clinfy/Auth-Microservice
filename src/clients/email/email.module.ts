import { Module } from '@nestjs/common';
import { EmailService } from 'src/clients/email/email.service';
import { TemplateService } from 'src/clients/email/template.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        imports: [ConfigModule],
        inject: [ConfigService],
        name: 'EMAIL_SERVICE',
        useFactory: async (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL') as string],
            queue: 'email_queue',
            queueOptions: {
              durable: true
            }
          }
        })
      }
    ]),
  ],
  providers: [EmailService, TemplateService],
  exports: [EmailService, TemplateService]
})
export class EmailModule {}
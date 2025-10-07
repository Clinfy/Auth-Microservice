import { Module } from '@nestjs/common';
import { EmailService } from 'src/clients/email/email.service';
import { TemplateService } from 'src/clients/email/template.service';

@Module({
  providers: [EmailService, TemplateService],
  exports: [EmailService, TemplateService]
})
export class EmailModule {}
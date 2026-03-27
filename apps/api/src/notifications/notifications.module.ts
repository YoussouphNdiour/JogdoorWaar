import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { GmailService } from './gmail.service';

@Module({
  providers: [EmailService, GmailService],
  exports: [EmailService, GmailService],
})
export class NotificationsModule {}

import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertDispatcherService } from './alert-dispatcher.service';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [WhatsAppModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertDispatcherService],
  exports: [AlertsService],
})
export class AlertsModule {}

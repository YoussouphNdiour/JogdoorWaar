import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppBotService } from './whatsapp-bot.service';
import { WhatsAppStateService } from './whatsapp-state.service';
import { WaSenderApiService } from './wasender-api.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppBotService, WhatsAppStateService, WaSenderApiService],
  exports: [WaSenderApiService], // AlertsModule uses this to send proactive messages
})
export class WhatsAppModule {}

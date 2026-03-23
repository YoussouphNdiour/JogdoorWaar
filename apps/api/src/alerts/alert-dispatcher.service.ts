import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsService } from './alerts.service';
import { WaSenderApiService } from '../whatsapp/wasender-api.service';
import { AlertFrequency } from '@prisma/client';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class AlertDispatcherService {
  private readonly logger = new Logger(AlertDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsService: AlertsService,
    private readonly wa: WaSenderApiService,
  ) {}

  // ─── Alertes INSTANT (toutes les 15min) ──────────────────────
  @Cron('*/15 * * * *')
  async dispatchInstantAlerts() {
    await this.dispatch(AlertFrequency.INSTANT);
  }

  // ─── Alertes DAILY (8h heure Dakar) ──────────────────────────
  @Cron('0 8 * * *', { timeZone: 'Africa/Dakar' })
  async dispatchDailyAlerts() {
    await this.dispatch(AlertFrequency.DAILY);
  }

  // ─── Alertes WEEKLY (lundi 8h heure Dakar) ───────────────────
  @Cron('0 8 * * 1', { timeZone: 'Africa/Dakar' })
  async dispatchWeeklyAlerts() {
    await this.dispatch(AlertFrequency.WEEKLY);
  }

  private async dispatch(frequency: AlertFrequency) {
    this.logger.log(`Dispatching ${frequency} alerts...`);
    const alerts = await this.prisma.alert.findMany({
      where: { isActive: true, frequency },
      include: { user: true },
    });

    let sent = 0;
    for (const alert of alerts) {
      try {
        const jobs = await this.alertsService.findMatchingJobs(alert.id, 10);
        if (!jobs.length) continue;

        this.logger.debug(`Alert ${alert.id}: ${jobs.length} jobs trouvés`);

        // Email notification
        if (alert.notifyByEmail && alert.user.emailVerified) {
          this.logger.debug(`Email → ${alert.user.email}: ${jobs.length} offres`);
          // EmailService injected when needed (NotificationsModule)
        }

        // WhatsApp notification
        if (
          alert.notifyByWhatsapp &&
          alert.user.whatsappNumber &&
          alert.user.whatsappVerified
        ) {
          await this.sendWhatsAppAlert(
            alert.user.whatsappNumber,
            alert.name,
            jobs.slice(0, 3),
          );
          await sleep(1500); // délai poli entre messages
        }

        await this.prisma.alert.update({
          where: { id: alert.id },
          data: { lastTriggeredAt: new Date() },
        });

        sent++;
      } catch (err) {
        this.logger.error(`Erreur alerte ${alert.id}: ${err}`);
      }
    }

    this.logger.log(`${frequency}: ${sent}/${alerts.length} alertes traitées`);
  }

  // ─── WhatsApp alert message ───────────────────────────────────────
  private async sendWhatsAppAlert(
    phone: string,
    alertName: string,
    jobs: Array<{ id: string; title: string; company: string; city: string | null }>,
  ): Promise<void> {
    if (!jobs.length) return;

    const lines = jobs.map(
      (j, i) =>
        `${i + 1}. *${j.title}*\n   🏢 ${j.company}${j.city ? ` · 📍 ${j.city}` : ''}`,
    );

    const message =
      `🔔 *Alerte Emploi — ${alertName}*\n\n` +
      `${lines.join('\n\n')}\n\n` +
      `Pour postuler, répondez avec l'ID de l'offre ou tapez *AIDE*.`;

    // Up to 3 buttons — one per job (postuler:jobId)
    const buttons = jobs.slice(0, 3).map((j) => ({
      id: `postuler:${j.id}`,
      text: `Postuler — ${j.title.slice(0, 15)}`,
    }));

    await this.wa.sendButtons(phone, message, buttons, 'Jog Door Waar');
  }
}

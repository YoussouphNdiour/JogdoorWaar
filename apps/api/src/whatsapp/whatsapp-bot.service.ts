import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { CvSelectorService } from '../ai/cv-selector.service';
import { WaSenderApiService } from './wasender-api.service';
import { WhatsAppStateService } from './whatsapp-state.service';
import { EmailService } from '../notifications/email.service';
import { GmailService } from '../notifications/gmail.service';
import { AuthService } from '../auth/auth.service';
import { WhatsAppBotState, Plan } from '@prisma/client';
import { SessionData } from './interfaces/bot-context.interface';
import { WaSenderMessage } from './dto/wasender-webhook.dto';

// ─── helpers ─────────────────────────────────────────────────────────
function extractPhone(remoteJid: string): string {
  return remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
}

function extractText(msg: WaSenderMessage): string {
  return (
    msg.message?.conversation ??
    msg.message?.extendedTextMessage?.text ??
    msg.message?.buttonsResponseMessage?.selectedButtonId ??
    msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId ??
    ''
  ).trim();
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

@Injectable()
export class WhatsAppBotService {
  private readonly logger = new Logger(WhatsAppBotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stateService: WhatsAppStateService,
    private readonly wa: WaSenderApiService,
    private readonly aiService: AiService,
    private readonly cvSelector: CvSelectorService,
    private readonly emailService: EmailService,
    private readonly gmailService: GmailService,
    private readonly authService: AuthService,
  ) {}

  // ─── Entry point called by controller (fire-and-forget) ──────────
  async handleMessage(msg: WaSenderMessage): Promise<void> {
    if (msg.key.fromMe) return; // ignore outbound echoes

    const phone = extractPhone(msg.key.remoteJid);
    const text = extractText(msg);

    const user = await this.prisma.user.findFirst({
      where: { whatsappNumber: phone, whatsappVerified: true },
      include: { profile: true },
    });

    if (!user) {
      await this.wa.sendText(
        phone,
        '👋 Bonjour ! Pour utiliser Jog Door Waar via WhatsApp, connectez-vous sur jogdoorwaar.sn et liez votre numéro dans votre profil.',
      );
      return;
    }

    const session = await this.stateService.getOrCreateSession(phone, user.id);

    // Global commands — available in any state
    if (/^(annuler|cancel|stop|quitter)$/i.test(text)) {
      await this.stateService.resetSession(session);
      await this.wa.sendText(phone, '❌ Action annulée. Envoyez *AIDE* pour voir les commandes disponibles.');
      return;
    }

    if (/^(aide|help|\?)$/i.test(text)) {
      await this.sendHelp(phone);
      return;
    }

    this.logger.debug(`[${phone}] state=${session.state} text="${text}"`);

    switch (session.state as WhatsAppBotState) {
      case WhatsAppBotState.IDLE:
        await this.handleIdle(session, text, phone);
        break;
      case WhatsAppBotState.SELECTING_CV:
        await this.handleSelectingCv(session, text, phone);
        break;
      case WhatsAppBotState.GENERATING_CV:
        await this.wa.sendText(phone, '⏳ Votre CV adapté est en cours de génération, patientez...');
        break;
      case WhatsAppBotState.CONFIRMING_CV:
        await this.handleConfirmingCv(session, text, phone);
        break;
      case WhatsAppBotState.GENERATING_COVER_LETTER:
        await this.wa.sendText(phone, '⏳ Votre lettre de motivation est en cours de génération...');
        break;
      case WhatsAppBotState.REVIEWING_COVER_LETTER:
        await this.handleReviewingCoverLetter(session, text, phone);
        break;
      case WhatsAppBotState.APPLYING:
        await this.wa.sendText(phone, '⏳ Candidature en cours...');
        break;
      case WhatsAppBotState.DONE:
        await this.stateService.resetSession(session);
        await this.handleIdle(session, text, phone);
        break;
      default:
        await this.stateService.resetSession(session);
        await this.sendHelp(phone);
    }
  }

  // ─── IDLE ─────────────────────────────────────────────────────────
  private async handleIdle(session: SessionData, text: string, phone: string) {
    // Accept "JOB:id" (from alert buttons) or direct job ID
    const jobIdMatch = text.match(/^(?:job:|postuler:|JOB:)([a-z0-9]+)$/i) ??
      text.match(/^([a-z0-9]{25})$/i); // cuid length ~25

    if (jobIdMatch) {
      const jobId = jobIdMatch[1];
      const job = await this.prisma.job.findUnique({ where: { id: jobId } });
      if (!job) {
        await this.wa.sendText(phone, '❌ Offre introuvable. Vérifiez l\'identifiant ou envoyez *AIDE*.');
        return;
      }
      await this.startApplicationFlow(session, job, phone);
      return;
    }

    // Save job shortcut: "sauvegarder:jobId"
    const saveMatch = text.match(/^sauvegarder:([a-z0-9]+)$/i);
    if (saveMatch) {
      await this.saveJob(session.userId, saveMatch[1], phone);
      return;
    }

    // Default: guide user
    await this.wa.sendText(
      phone,
      `👋 Bonjour${session.userId ? ' !' : ''}\n\nEnvoyez l'identifiant d'une offre pour postuler, ou utilisez les boutons dans vos alertes emploi.\n\nCommandes : *AIDE* · *ANNULER*`,
    );
  }

  // ─── Start application flow ──────────────────────────────────────
  private async startApplicationFlow(
    session: SessionData,
    job: { id: string; title: string; company: string },
    phone: string,
  ) {
    const cvs = await this.prisma.userCV.findMany({
      where: { userId: session.userId },
      select: { id: true, name: true, label: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    if (!cvs.length) {
      await this.wa.sendText(
        phone,
        `💼 *${job.title}* — ${job.company}\n\nVous n'avez pas encore de CV. Rendez-vous sur *jogdoorwaar.sn* pour en uploader un, puis revenez postuler !`,
      );
      return;
    }

    await this.stateService.transition(session, WhatsAppBotState.SELECTING_CV, {
      jobId: job.id,
      jobTitle: job.title,
      jobCompany: job.company,
    });

    if (cvs.length <= 3) {
      await this.wa.sendButtons(
        phone,
        `💼 *${truncate(job.title, 60)}*\n${job.company}\n\nQuel CV souhaitez-vous utiliser ?`,
        cvs.map((cv) => ({
          id: `cv:${cv.id}`,
          text: truncate(cv.label ?? cv.name, 20),
        })),
        'Envoyez ANNULER pour quitter',
      );
    } else {
      await this.wa.sendList(
        phone,
        `Postuler — ${truncate(job.title, 40)}`,
        `Choisissez votre CV pour postuler chez *${job.company}*`,
        'Voir mes CVs',
        [
          {
            title: 'Mes CVs',
            rows: cvs.slice(0, 10).map((cv) => ({
              id: `cv:${cv.id}`,
              title: truncate(cv.label ?? cv.name, 24),
              description: 'CV disponible',
            })),
          },
        ],
      );
    }
  }

  // ─── SELECTING_CV ────────────────────────────────────────────────
  private async handleSelectingCv(session: SessionData, text: string, phone: string) {
    const cvMatch = text.match(/^cv:([a-z0-9]+)$/i);
    if (!cvMatch) {
      await this.wa.sendText(phone, '👆 Veuillez sélectionner un CV dans la liste ou envoyer *ANNULER*.');
      return;
    }

    const cvId = cvMatch[1];
    const cv = await this.prisma.userCV.findFirst({
      where: { id: cvId, userId: session.userId },
    });

    if (!cv) {
      await this.wa.sendText(phone, '❌ CV introuvable. Veuillez réessayer.');
      return;
    }

    await this.stateService.transition(session, WhatsAppBotState.CONFIRMING_CV, {
      selectedCvId: cvId,
      selectedCvLabel: cv.label ?? cv.name,
    });

    await this.wa.sendButtons(
      phone,
      `✅ CV sélectionné : *${truncate(cv.label ?? cv.name, 40)}*\n\nSouhaitez-vous générer une *lettre de motivation* adaptée à cette offre ?`,
      [
        { id: 'cover_letter:yes', text: '✍️ Oui, générer' },
        { id: 'cover_letter:no', text: '🚀 Non, postuler' },
      ],
      'IA — Jog Door Waar',
    );
  }

  // ─── CONFIRMING_CV ───────────────────────────────────────────────
  private async handleConfirmingCv(session: SessionData, text: string, phone: string) {
    if (text === 'cover_letter:yes') {
      await this.generateCoverLetter(session, phone);
      return;
    }
    if (text === 'cover_letter:no') {
      await this.applyNow(session, phone, false);
      return;
    }
    await this.wa.sendText(phone, '👆 Utilisez les boutons pour choisir, ou envoyez *ANNULER*.');
  }

  // ─── Generate cover letter ───────────────────────────────────────
  private async generateCoverLetter(session: SessionData, phone: string) {
    await this.stateService.transition(session, WhatsAppBotState.GENERATING_COVER_LETTER);
    await this.wa.sendText(phone, '✍️ Génération de votre lettre de motivation en cours...');

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: session.userId },
        select: { plan: true },
      });

      const { coverLetter } = await this.aiService.generateCoverLetter(
        session.userId,
        session.context.jobId!,
        session.context.selectedCvId!,
      );

      await this.stateService.transition(session, WhatsAppBotState.REVIEWING_COVER_LETTER, {
        coverLetterDraft: coverLetter,
      });

      const preview = truncate(coverLetter, 300);
      await this.wa.sendButtons(
        phone,
        `📄 *Lettre de motivation générée*\n\n${preview}${coverLetter.length > 300 ? '\n\n_(voir version complète sur jogdoorwaar.sn)_' : ''}`,
        [
          { id: 'cover_letter:use', text: '✅ Utiliser' },
          { id: 'cover_letter:regen', text: '🔄 Régénérer' },
          { id: 'cover_letter:skip', text: '❌ Sans lettre' },
        ],
        'IA — Jog Door Waar',
      );
    } catch (err) {
      this.logger.error(`Cover letter generation failed: ${err}`);
      await this.stateService.transition(session, WhatsAppBotState.CONFIRMING_CV);
      await this.wa.sendText(
        phone,
        '⚠️ Impossible de générer la lettre pour l\'instant. Vous pouvez postuler sans lettre.',
      );
      await this.wa.sendButtons(
        phone,
        'Que souhaitez-vous faire ?',
        [
          { id: 'cover_letter:no', text: '🚀 Postuler sans lettre' },
          { id: 'cover_letter:yes', text: '🔄 Réessayer' },
        ],
      );
    }
  }

  // ─── REVIEWING_COVER_LETTER ───────────────────────────────────────
  private async handleReviewingCoverLetter(session: SessionData, text: string, phone: string) {
    if (text === 'cover_letter:use') {
      await this.applyNow(session, phone, true);
      return;
    }
    if (text === 'cover_letter:regen') {
      const regen = (session.context.coverLetterRegen ?? 0) + 1;
      if (regen > 3) {
        await this.wa.sendText(phone, '⚠️ Limite de régénération atteinte (3 max). Utilisation de la dernière version.');
        await this.applyNow(session, phone, true);
        return;
      }
      await this.stateService.transition(session, WhatsAppBotState.REVIEWING_COVER_LETTER, {
        coverLetterRegen: regen,
      });
      await this.generateCoverLetter(session, phone);
      return;
    }
    if (text === 'cover_letter:skip') {
      await this.applyNow(session, phone, false);
      return;
    }
    await this.wa.sendText(phone, '👆 Utilisez les boutons ci-dessus, ou envoyez *ANNULER*.');
  }

  // ─── Create / update Application record ──────────────────────────
  private async applyNow(session: SessionData, phone: string, withCoverLetter: boolean) {
    await this.stateService.transition(session, WhatsAppBotState.APPLYING);
    await this.wa.sendText(phone, '🚀 Candidature en cours...');

    try {
      const application = await this.prisma.application.upsert({
        where: {
          userId_jobId: { userId: session.userId, jobId: session.context.jobId! },
        },
        create: {
          userId: session.userId,
          jobId: session.context.jobId!,
          cvId: session.context.selectedCvId,
          status: 'APPLIED',
          appliedAt: new Date(),
          appliedVia: 'WHATSAPP',
          generatedCoverLetter: withCoverLetter ? session.context.coverLetterDraft : null,
        },
        update: {
          cvId: session.context.selectedCvId,
          status: 'APPLIED',
          appliedAt: new Date(),
          appliedVia: 'WHATSAPP',
          generatedCoverLetter: withCoverLetter ? session.context.coverLetterDraft : undefined,
        },
        include: { job: true },
      });

      await this.stateService.transition(session, WhatsAppBotState.DONE, {
        applicationId: application.id,
      });

      // Fire-and-forget: send email to recruiter
      this.sendApplicationEmailToRecruiter(
        application.id,
        session.userId,
        session.context.jobId!,
        session.context.selectedCvId ?? null,
        withCoverLetter ? (session.context.coverLetterDraft ?? null) : null,
      ).catch((err) => this.logger.warn(`WhatsApp application email skipped: ${err?.message}`));

      await this.wa.sendText(
        phone,
        `🎉 *Candidature enregistrée !*\n\n` +
        `📋 Poste : *${application.job.title}*\n` +
        `🏢 Entreprise : ${application.job.company}\n` +
        `📄 CV : ${session.context.selectedCvLabel}\n` +
        `${withCoverLetter ? '✍️ Avec lettre de motivation\n' : ''}` +
        `\nSuivez vos candidatures sur *jogdoorwaar.sn* → Mes Candidatures`,
      );

      await this.stateService.resetSession(session);
    } catch (err) {
      this.logger.error(`Apply failed: ${err}`);
      await this.stateService.transition(session, WhatsAppBotState.CONFIRMING_CV);
      await this.wa.sendText(
        phone,
        '⚠️ Une erreur est survenue lors de la candidature. Veuillez réessayer ou continuer sur jogdoorwaar.sn.',
      );
    }
  }

  // ─── Save job shortcut ────────────────────────────────────────────
  private async saveJob(userId: string, jobId: string, phone: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      await this.wa.sendText(phone, '❌ Offre introuvable.');
      return;
    }
    await this.prisma.savedJob.upsert({
      where: { userId_jobId: { userId, jobId } },
      create: { userId, jobId },
      update: {},
    });
    await this.wa.sendText(phone, `💾 *${job.title}* sauvegardée ! Retrouvez-la sur jogdoorwaar.sn → Offres sauvegardées.`);
  }

  // ─── Email to recruiter ───────────────────────────────────────────
  private async sendApplicationEmailToRecruiter(
    applicationId: string,
    userId: string,
    jobId: string,
    cvId: string | null,
    coverLetter: string | null,
  ): Promise<void> {
    const [job, user, cv] = await Promise.all([
      this.prisma.job.findUnique({
        where: { id: jobId },
        select: { title: true, company: true, description: true, recruiterId: true, sourcePlatform: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true, email: true },
      }),
      cvId
        ? this.prisma.userCV.findUnique({
            where: { id: cvId },
            select: { fileUrl: true, name: true, label: true },
          })
        : this.prisma.userCV.findFirst({
            where: { userId, isDefault: true },
            select: { fileUrl: true, name: true, label: true },
          }),
    ]);

    if (!job || !user) return;

    let recruiterEmail: string | null = null;
    if (job.sourcePlatform === 'DIRECT' && job.recruiterId) {
      const recruiter = await this.prisma.user.findUnique({
        where: { id: job.recruiterId },
        select: { email: true },
      });
      recruiterEmail = recruiter?.email ?? null;
    }
    if (!recruiterEmail && job.description) {
      const match = job.description.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
      recruiterEmail = match?.[0] ?? null;
    }
    if (!recruiterEmail) return;

    const cvLabel = cv?.label ?? cv?.name;
    const emailParams = {
      to: recruiterEmail,
      candidateName: `${user.firstName} ${user.lastName}`,
      candidateEmail: user.email,
      jobTitle: job.title,
      company: job.company,
      cvUrl: cv?.fileUrl ?? undefined,
      cvFileName: cvLabel ? `${cvLabel}.pdf` : 'cv.pdf',
      coverLetter: coverLetter ?? undefined,
    };

    // Try Gmail first (user's own account), fall back to Resend (JDW account)
    let emailId: string;
    const gmailTokens = await this.authService.getGmailTokens(userId);
    if (gmailTokens) {
      try {
        emailId = await this.gmailService.sendApplicationEmail({
          ...emailParams,
          googleAccessToken: gmailTokens.accessToken,
          googleRefreshToken: gmailTokens.refreshToken,
        });
        this.logger.log(`WA application email sent via Gmail for user ${userId}`);
      } catch (err) {
        this.logger.warn(`Gmail send failed, falling back to Resend: ${err instanceof Error ? err.message : String(err)}`);
        emailId = await this.emailService.sendApplicationEmail(emailParams);
      }
    } else {
      emailId = await this.emailService.sendApplicationEmail(emailParams);
    }

    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        recruiterEmailSentTo: recruiterEmail,
        emailSentAt: new Date(),
        emailResendId: emailId,
      },
    });
  }

  // ─── Help message ─────────────────────────────────────────────────
  private async sendHelp(phone: string) {
    await this.wa.sendText(
      phone,
      `🤖 *Jog Door Waar — Bot WhatsApp*\n\n` +
      `*Commandes disponibles :*\n` +
      `• Tapez l'ID d'une offre pour postuler\n` +
      `• *ANNULER* — Annuler l'action en cours\n` +
      `• *AIDE* — Afficher ce message\n\n` +
      `💡 Vous pouvez aussi utiliser les boutons dans vos alertes emploi.\n\n` +
      `🌐 Site : *jogdoorwaar.sn*`,
    );
  }
}

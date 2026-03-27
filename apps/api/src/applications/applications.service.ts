import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationChannel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { GmailService } from '../notifications/gmail.service';
import { AuthService } from '../auth/auth.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly gmailService: GmailService,
    private readonly authService: AuthService,
  ) {}

  async findAll(userId: string) {
    const apps = await this.prisma.application.findMany({
      where: { userId },
      include: {
        job: { select: { title: true, company: true, city: true, sourceUrl: true } },
        cv: { select: { name: true, fileUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apps.map((a) => ({
      id: a.id,
      jobId: a.jobId,
      jobTitle: a.job.title,
      company: a.job.company,
      city: a.job.city ?? 'Dakar',
      sourceUrl: a.job.sourceUrl,
      appliedAt: a.appliedAt?.toISOString() ?? a.createdAt.toISOString(),
      status: a.status,
      channel: a.appliedVia,
      cvUsed: a.cv?.name ?? '',
      coverLetter: a.generatedCoverLetter ?? undefined,
      recruiterEmailSentTo: a.recruiterEmailSentTo ?? undefined,
      emailSentAt: a.emailSentAt?.toISOString() ?? undefined,
      emailResendId: a.emailResendId ?? undefined,
      notes: a.notes ?? undefined,
      interviewDate: a.interviewDate?.toISOString() ?? undefined,
      offerAmount: a.offerAmount ?? undefined,
    }));
  }

  async create(userId: string, dto: CreateApplicationDto) {
    // Check for existing application
    const existing = await this.prisma.application.findUnique({
      where: { userId_jobId: { userId, jobId: dto.jobId } },
    });
    if (existing) {
      throw new ConflictException('Vous avez déjà postulé à cette offre');
    }

    const app = await this.prisma.application.create({
      data: {
        userId,
        jobId: dto.jobId,
        cvId: dto.cvId ?? null,
        appliedVia: dto.channel ?? ApplicationChannel.WEB,
        generatedCoverLetter: dto.coverLetter ?? null,
        status: 'APPLIED',
        appliedAt: new Date(),
      },
      include: {
        job: { select: { title: true, company: true, city: true } },
      },
    });

    // Fire-and-forget: send email to recruiter (non-blocking)
    this.sendApplicationEmailToRecruiter(
      app.id,
      userId,
      dto.jobId,
      dto.cvId ?? null,
      dto.coverLetter ?? null,
    ).catch((err) =>
      this.logger.warn(`Application email skipped: ${err?.message}`),
    );

    return {
      id: app.id,
      jobId: app.jobId,
      jobTitle: app.job.title,
      company: app.job.company,
      city: app.job.city ?? 'Dakar',
      appliedAt: app.appliedAt?.toISOString() ?? app.createdAt.toISOString(),
      status: app.status,
      channel: app.appliedVia,
    };
  }

  async update(userId: string, applicationId: string, dto: UpdateApplicationDto) {
    const app = await this.prisma.application.findFirst({
      where: { id: applicationId, userId },
    });
    if (!app) {
      throw new NotFoundException('Candidature introuvable');
    }

    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        ...(dto.status && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.interviewDate && { interviewDate: new Date(dto.interviewDate) }),
      },
      include: {
        job: { select: { title: true, company: true, city: true } },
      },
    });

    return {
      id: updated.id,
      jobId: updated.jobId,
      jobTitle: updated.job.title,
      company: updated.job.company,
      status: updated.status,
    };
  }

  async remove(userId: string, applicationId: string): Promise<void> {
    const app = await this.prisma.application.findFirst({
      where: { id: applicationId, userId },
    });
    if (!app) {
      throw new NotFoundException('Candidature introuvable');
    }
    await this.prisma.application.delete({ where: { id: applicationId } });
  }

  // ─── Email helper ──────────────────────────────────────────────────────────

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

    // 1. DIRECT jobs → use recruiter's account email
    let recruiterEmail: string | null = null;
    if (job.sourcePlatform === 'DIRECT' && job.recruiterId) {
      const recruiter = await this.prisma.user.findUnique({
        where: { id: job.recruiterId },
        select: { email: true },
      });
      recruiterEmail = recruiter?.email ?? null;
    }

    // 2. Scraped jobs → extract email from description
    if (!recruiterEmail && job.description) {
      const match = job.description.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
      recruiterEmail = match?.[0] ?? null;
    }

    if (!recruiterEmail) {
      this.logger.debug(`No recruiter email found for job ${jobId} — skipping application email`);
      return;
    }

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
        this.logger.log(`Application email sent via Gmail for user ${userId}`);
      } catch (err) {
        this.logger.warn(`Gmail send failed, falling back to Resend: ${err instanceof Error ? err.message : String(err)}`);
        emailId = await this.emailService.sendApplicationEmail(emailParams);
      }
    } else {
      emailId = await this.emailService.sendApplicationEmail(emailParams);
    }

    // Store proof of sending on the application record
    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        recruiterEmailSentTo: recruiterEmail,
        emailSentAt: new Date(),
        emailResendId: emailId,
      },
    });
  }
}

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationChannel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

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
      appliedAt: a.appliedAt?.toISOString() ?? a.createdAt.toISOString(),
      status: a.status,
      channel: a.appliedVia,
      cvUsed: a.cv?.name ?? '',
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
}

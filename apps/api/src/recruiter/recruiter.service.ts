import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JobType, SourcePlatform, WorkMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecruiterJobDto } from './dto/create-recruiter-job.dto';

const WORK_MODE_MAP: Record<string, WorkMode> = {
  REMOTE: WorkMode.REMOTE,
  HYBRID: WorkMode.HYBRID,
  ON_SITE: WorkMode.ON_SITE,
};

const JOB_TYPE_MAP: Record<string, JobType> = {
  CDI: JobType.CDI,
  CDD: JobType.CDD,
  STAGE: JobType.STAGE,
  ALTERNANCE: JobType.ALTERNANCE,
  FREELANCE: JobType.FREELANCE,
};

@Injectable()
export class RecruiterService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Stats ────────────────────────────────────────────────────────────────────

  async getStats(recruiterId: string) {
    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );

    const [activeJobs, totalJobs, totalApplications, aggregates, jobsThisMonth, user] =
      await Promise.all([
        this.prisma.job.count({ where: { recruiterId, isActive: true } }),
        this.prisma.job.count({ where: { recruiterId } }),
        this.prisma.application.count({ where: { job: { recruiterId } } }),
        this.prisma.job.aggregate({
          where: { recruiterId },
          _sum: { viewCount: true, clickCount: true },
        }),
        this.prisma.job.count({ where: { recruiterId, createdAt: { gte: startOfMonth } } }),
        this.prisma.user.findUnique({ where: { id: recruiterId }, select: { plan: true } }),
      ]);

    return {
      activeJobs,
      totalJobs,
      totalApplications,
      totalViews: aggregates._sum.viewCount ?? 0,
      totalClicks: aggregates._sum.clickCount ?? 0,
      plan: user?.plan ?? 'RECRUITER',
      jobsThisMonth,
      jobsRemainingThisMonth: Math.max(0, 10 - jobsThisMonth),
    };
  }

  // ─── Jobs ─────────────────────────────────────────────────────────────────────

  async getJobs(recruiterId: string) {
    const jobs = await this.prisma.job.findMany({
      where: { recruiterId },
      include: { _count: { select: { applications: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return jobs.map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      city: j.city ?? '',
      country: j.country,
      workMode: j.workMode,
      jobType: j.jobType,
      sector: j.sector,
      salaryMin: j.salaryMin,
      salaryMax: j.salaryMax,
      descriptionFull: j.description,
      requiredSkills: j.requiredSkills,
      status: j.isActive ? 'ACTIVE' : 'PAUSED',
      applicationsCount: j._count.applications,
      publishedAt: j.publishedAt.toISOString(),
      createdAt: j.createdAt.toISOString(),
    }));
  }

  async getJob(recruiterId: string, jobId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, recruiterId },
      include: { _count: { select: { applications: true } } },
    });
    if (!job) {
      throw new NotFoundException('Offre introuvable');
    }

    return {
      id: job.id,
      title: job.title,
      company: job.company,
      city: job.city ?? '',
      country: job.country,
      workMode: job.workMode,
      jobType: job.jobType,
      sector: job.sector,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      descriptionFull: job.description,
      requiredSkills: job.requiredSkills,
      status: job.isActive ? 'ACTIVE' : 'PAUSED',
      applicationsCount: job._count.applications,
      publishedAt: job.publishedAt.toISOString(),
    };
  }

  async createJob(recruiterId: string, dto: CreateRecruiterJobDto) {
    // Enforce 10 jobs/month limit
    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );
    const jobsThisMonth = await this.prisma.job.count({
      where: { recruiterId, createdAt: { gte: startOfMonth } },
    });
    if (jobsThisMonth >= 10) {
      throw new ForbiddenException('Limite de 10 offres/mois atteinte');
    }

    const fingerprint = `DIRECT-${recruiterId}-${dto.title}-${Date.now()}`;
    const job = await this.prisma.job.create({
      data: {
        fingerprint,
        title: dto.title,
        company: dto.company,
        city: dto.city,
        country: dto.country ?? 'Sénégal',
        workMode: WORK_MODE_MAP[dto.workMode ?? 'ON_SITE'] ?? WorkMode.ON_SITE,
        jobType: JOB_TYPE_MAP[dto.jobType ?? 'CDI'] ?? JobType.CDI,
        sector: dto.sector ?? null,
        salaryMin: dto.salaryMin ?? null,
        salaryMax: dto.salaryMax ?? null,
        description: dto.descriptionFull,
        requiredSkills: dto.requiredSkills ?? [],
        sourcePlatform: SourcePlatform.DIRECT,
        sourceUrl: `direct://${recruiterId}/${Date.now()}`,
        publishedAt: new Date(),
        isActive: true,
        isVerified: false,
        recruiterId,
      },
    });

    return {
      id: job.id,
      title: job.title,
      company: job.company,
      city: job.city ?? '',
      country: job.country,
      workMode: job.workMode,
      jobType: job.jobType,
      sector: job.sector,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      descriptionFull: job.description,
      requiredSkills: job.requiredSkills,
      status: 'ACTIVE',
      applicationsCount: 0,
      publishedAt: job.publishedAt.toISOString(),
      viewCount: 0,
      clickCount: 0,
      isBoosted: false,
    };
  }

  async updateJob(
    recruiterId: string,
    jobId: string,
    dto: Partial<CreateRecruiterJobDto> & { status?: string },
  ) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, recruiterId },
    });
    if (!job) {
      throw new NotFoundException('Offre introuvable');
    }

    const updated = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.company && { company: dto.company }),
        ...(dto.city && { city: dto.city }),
        ...(dto.country && { country: dto.country }),
        ...(dto.workMode && { workMode: WORK_MODE_MAP[dto.workMode] ?? undefined }),
        ...(dto.jobType && { jobType: JOB_TYPE_MAP[dto.jobType] ?? undefined }),
        ...(dto.sector !== undefined && { sector: dto.sector }),
        ...(dto.salaryMin !== undefined && { salaryMin: dto.salaryMin }),
        ...(dto.salaryMax !== undefined && { salaryMax: dto.salaryMax }),
        ...(dto.descriptionFull && { description: dto.descriptionFull }),
        ...(dto.requiredSkills && { requiredSkills: dto.requiredSkills }),
        ...(dto.status === 'PAUSED' && { isActive: false }),
        ...(dto.status === 'ACTIVE' && { isActive: true }),
      },
    });

    return {
      id: updated.id,
      title: updated.title,
      status: updated.isActive ? 'ACTIVE' : 'PAUSED',
    };
  }

  async deleteJob(recruiterId: string, jobId: string): Promise<void> {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, recruiterId },
    });
    if (!job) {
      throw new NotFoundException('Offre introuvable');
    }
    await this.prisma.job.delete({ where: { id: jobId } });
  }

  // ─── Applications (recruiter view) ───────────────────────────────────────────

  async getApplications(recruiterId: string, jobId: string) {
    // Verify ownership first
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, recruiterId },
    });
    if (!job) {
      throw new NotFoundException('Offre introuvable');
    }

    const apps = await this.prisma.application.findMany({
      where: { jobId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        cv: { select: { fileUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const userIds = apps.map((a) => a.userId);
    const matchScores = await this.prisma.matchScore.findMany({
      where: { jobId, userId: { in: userIds } },
      select: { userId: true, score: true },
    });
    const matchScoreMap = new Map(matchScores.map((m) => [m.userId, m.score]));

    return apps.map((a) => ({
      id: a.id,
      jobId: a.jobId,
      candidateName: `${a.user.firstName} ${a.user.lastName}`,
      candidateEmail: a.user.email,
      cvUrl: a.cv?.fileUrl ?? null,
      coverLetter: a.generatedCoverLetter ?? null,
      status: a.recruiterStatus,
      channel: a.appliedVia,
      appliedAt: a.appliedAt?.toISOString() ?? a.createdAt.toISOString(),
      matchScore: matchScoreMap.get(a.userId) ?? null,
    }));
  }

  async updateApplicationStatus(
    recruiterId: string,
    jobId: string,
    appId: string,
    status: string,
  ) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, recruiterId },
    });
    if (!job) {
      throw new NotFoundException('Offre introuvable');
    }

    const app = await this.prisma.application.findFirst({
      where: { id: appId, jobId },
    });
    if (!app) {
      throw new NotFoundException('Candidature introuvable');
    }

    const updated = await this.prisma.application.update({
      where: { id: appId },
      data: { recruiterStatus: status as import('@prisma/client').RecruiterApplicationStatus },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        cv: { select: { fileUrl: true } },
      },
    });

    return {
      id: updated.id,
      jobId: updated.jobId,
      candidateName: `${updated.user.firstName} ${updated.user.lastName}`,
      candidateEmail: updated.user.email,
      cvUrl: updated.cv?.fileUrl ?? null,
      coverLetter: updated.generatedCoverLetter ?? null,
      status: updated.recruiterStatus,
      channel: updated.appliedVia,
      appliedAt: updated.appliedAt?.toISOString() ?? updated.createdAt.toISOString(),
    };
  }
}

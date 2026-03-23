import { Injectable } from '@nestjs/common';
import { Plan, UserRole } from '@jdw/shared-types';
import { Job, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformStats } from './interfaces/platform-stats.interface';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateJobDto } from './dto/update-job.dto';

const PLAN_PRICE_FCFA: Record<string, number> = {
  FREE: 0,
  PREMIUM: 3_500,
  RECRUITER: 15_000,
};

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Stats ────────────────────────────────────────────────────────────────────

  async getPlatformStats(): Promise<PlatformStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    const [
      totalUsers,
      newUsersThisMonth,
      premiumUsers,
      recruiterUsers,
      totalJobs,
      activeJobs,
      jobsThisWeek,
      totalApplications,
      activeSubscriptions,
      jobsBySource,
    ] = await Promise.all([
      this.prisma.user.count(),

      this.prisma.user.count({
        where: { createdAt: { gte: startOfMonth } },
      }),

      this.prisma.user.count({ where: { plan: Plan.PREMIUM } }),

      this.prisma.user.count({ where: { plan: Plan.RECRUITER } }),

      this.prisma.job.count(),

      this.prisma.job.count({ where: { isActive: true } }),

      this.prisma.job.count({
        where: { publishedAt: { gte: startOfWeek } },
      }),

      this.prisma.application.count(),

      this.prisma.user.count({
        where: { plan: { in: [Plan.PREMIUM, Plan.RECRUITER] } },
      }),

      this.prisma.job.groupBy({
        by: ['sourcePlatform'],
        _count: { id: true },
      }),
    ]);

    // Revenue: sum(count of active subscriptions per plan × price)
    const [premiumCount, recruiterCount] = await Promise.all([
      this.prisma.user.count({ where: { plan: Plan.PREMIUM } }),
      this.prisma.user.count({ where: { plan: Plan.RECRUITER } }),
    ]);

    const monthlyRevenueFcfa =
      premiumCount * PLAN_PRICE_FCFA['PREMIUM'] +
      recruiterCount * PLAN_PRICE_FCFA['RECRUITER'];

    const jobsPerSource: Record<string, number> = {};
    for (const row of jobsBySource) {
      jobsPerSource[row.sourcePlatform] = row._count.id;
    }

    return {
      totalUsers,
      newUsersThisMonth,
      premiumUsers,
      recruiterUsers,
      totalJobs,
      activeJobs,
      jobsThisWeek,
      totalApplications,
      activeSubscriptions,
      monthlyRevenueFcfa,
      jobsPerSource,
    };
  }

  // ─── Users ────────────────────────────────────────────────────────────────────

  async getUsers(
    page: number,
    limit: number,
    search?: string,
    plan?: string,
    role?: string,
  ): Promise<{ data: User[]; total: number; page: number }> {
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where['OR'] = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (plan) {
      where['plan'] = plan;
    }

    if (role) {
      where['role'] = role;
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, total, page };
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.plan !== undefined && { plan: dto.plan }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  // ─── Jobs ─────────────────────────────────────────────────────────────────────

  async getJobs(
    page: number,
    limit: number,
    sourcePlatform?: string,
    isVerified?: boolean,
    isActive?: boolean,
  ): Promise<{ data: Job[]; total: number; page: number }> {
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (sourcePlatform) {
      where['sourcePlatform'] = sourcePlatform;
    }

    if (isVerified !== undefined) {
      where['isVerified'] = isVerified;
    }

    if (isActive !== undefined) {
      where['isActive'] = isActive;
    }

    const [data, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishedAt: 'desc' },
      }),
      this.prisma.job.count({ where }),
    ]);

    return { data, total, page };
  }

  async updateJob(id: string, dto: UpdateJobDto): Promise<Job> {
    return this.prisma.job.update({
      where: { id },
      data: {
        ...(dto.isVerified !== undefined && { isVerified: dto.isVerified }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.isPremium !== undefined && { isPremium: dto.isPremium }),
      },
    });
  }

  async deleteJob(id: string): Promise<void> {
    await this.prisma.job.delete({ where: { id } });
  }

  // ─── Scraping stats ───────────────────────────────────────────────────────────

  async getScrapingStats(): Promise<
    { platform: string; total: number; lastScraped: Date | null }[]
  > {
    const rows = await this.prisma.job.groupBy({
      by: ['sourcePlatform'],
      _count: { id: true },
      _max: { scrapedAt: true },
    });

    return rows.map((row) => ({
      platform: row.sourcePlatform,
      total: row._count.id,
      lastScraped: row._max.scrapedAt ?? null,
    }));
  }
}

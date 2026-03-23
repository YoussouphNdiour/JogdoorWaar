import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { Plan } from '@prisma/client';

const FREE_PLAN_MAX_ALERTS = 2;

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.alert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateAlertDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    if (user.plan === Plan.FREE) {
      const count = await this.prisma.alert.count({ where: { userId } });
      if (count >= FREE_PLAN_MAX_ALERTS) {
        throw new ForbiddenException(
          `Plan gratuit limité à ${FREE_PLAN_MAX_ALERTS} alertes. Passez à Premium pour en créer plus.`,
        );
      }
    }

    return this.prisma.alert.create({
      data: {
        userId,
        name: dto.name,
        keywords: dto.keywords,
        excludeKeywords: dto.excludeKeywords ?? [],
        locations: dto.locations ?? [],
        jobTypes: dto.jobTypes ?? [],
        workModes: dto.workModes ?? [],
        sectors: dto.sectors ?? [],
        salaryMin: dto.salaryMin,
        salaryMax: dto.salaryMax,
        notifyByEmail: dto.notifyByEmail ?? true,
        notifyByWhatsapp: dto.notifyByWhatsapp ?? false,
        frequency: dto.frequency ?? 'DAILY',
        isActive: true,
      },
    });
  }

  async update(userId: string, alertId: string, dto: UpdateAlertDto) {
    await this.findOneOwned(userId, alertId);
    return this.prisma.alert.update({
      where: { id: alertId },
      data: dto,
    });
  }

  async remove(userId: string, alertId: string) {
    await this.findOneOwned(userId, alertId);
    await this.prisma.alert.delete({ where: { id: alertId } });
  }

  async toggle(userId: string, alertId: string) {
    const alert = await this.findOneOwned(userId, alertId);
    return this.prisma.alert.update({
      where: { id: alertId },
      data: { isActive: !alert.isActive },
    });
  }

  async getStats(userId: string) {
    const alerts = await this.prisma.alert.findMany({
      where: { userId, isActive: true },
    });
    return alerts.map((a) => ({ id: a.id, name: a.name, lastTriggeredAt: a.lastTriggeredAt }));
  }

  async findMatchingJobs(alertId: string, limit = 10) {
    const alert = await this.prisma.alert.findUnique({ where: { id: alertId } });
    if (!alert) throw new NotFoundException('Alerte non trouvée');

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    return this.prisma.job.findMany({
      where: {
        isActive: true,
        publishedAt: { gte: sevenDaysAgo },
        AND: [
          alert.keywords.length > 0
            ? {
                OR: alert.keywords.map((kw) => ({
                  OR: [
                    { title: { contains: kw, mode: 'insensitive' } },
                    { description: { contains: kw, mode: 'insensitive' } },
                    { requiredSkills: { has: kw } },
                  ],
                })),
              }
            : {},
          alert.locations.length > 0
            ? { city: { in: alert.locations, mode: 'insensitive' } }
            : {},
          alert.jobTypes.length > 0 ? { jobType: { in: alert.jobTypes } } : {},
          alert.workModes.length > 0 ? { workMode: { in: alert.workModes } } : {},
          alert.salaryMin ? { salaryMin: { gte: alert.salaryMin } } : {},
          alert.salaryMax ? { salaryMax: { lte: alert.salaryMax } } : {},
          alert.excludeKeywords.length > 0
            ? {
                NOT: alert.excludeKeywords.map((kw) => ({
                  OR: [
                    { title: { contains: kw, mode: 'insensitive' } },
                    { description: { contains: kw, mode: 'insensitive' } },
                  ],
                })),
              }
            : {},
        ],
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });
  }

  private async findOneOwned(userId: string, alertId: string) {
    const alert = await this.prisma.alert.findFirst({
      where: { id: alertId, userId },
    });
    if (!alert) throw new NotFoundException('Alerte non trouvée');
    return alert;
  }
}

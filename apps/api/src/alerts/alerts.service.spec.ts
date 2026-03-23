import { Test, TestingModule } from '@nestjs/testing';
import { AlertsService } from './alerts.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Plan } from '@prisma/client';
import { CreateAlertDto } from './dto/create-alert.dto';

const FREE_USER = { id: 'user-free', plan: Plan.FREE, email: 'free@test.sn' };
const PREMIUM_USER = { id: 'user-premium', plan: Plan.PREMIUM, email: 'premium@test.sn' };

const baseAlertDto: CreateAlertDto = {
  name: 'Dev React Dakar',
  keywords: ['React', 'TypeScript'],
  frequency: 'DAILY' as any,
};

describe('AlertsService', () => {
  let service: AlertsService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn() },
            alert: {
              count: jest.fn(),
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            job: { findMany: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create() ─────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('crée une alerte pour un utilisateur PREMIUM sans limite', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(PREMIUM_USER);
      const created = { id: 'alert-1', ...baseAlertDto, userId: PREMIUM_USER.id };
      (prisma.alert.create as jest.Mock).mockResolvedValue(created);

      const result = await service.create(PREMIUM_USER.id, baseAlertDto);

      expect(result).toEqual(created);
      expect(prisma.alert.count).not.toHaveBeenCalled();
    });

    it('crée une alerte pour FREE si moins de 2 alertes existent', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(FREE_USER);
      (prisma.alert.count as jest.Mock).mockResolvedValue(1);
      const created = { id: 'alert-2', ...baseAlertDto, userId: FREE_USER.id };
      (prisma.alert.create as jest.Mock).mockResolvedValue(created);

      const result = await service.create(FREE_USER.id, baseAlertDto);

      expect(result).toEqual(created);
    });

    it('lève ForbiddenException si FREE atteint la limite de 2 alertes', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(FREE_USER);
      (prisma.alert.count as jest.Mock).mockResolvedValue(2);

      await expect(service.create(FREE_USER.id, baseAlertDto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.alert.create).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si l\'utilisateur n\'existe pas', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.create('ghost-id', baseAlertDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── findMatchingJobs() ───────────────────────────────────────────────────

  describe('findMatchingJobs()', () => {
    it('retourne les offres correspondant aux critères de l\'alerte', async () => {
      const alert = {
        id: 'alert-1',
        userId: PREMIUM_USER.id,
        keywords: ['React'],
        locations: ['Dakar'],
        jobTypes: [],
        workModes: [],
        salaryMin: null,
        salaryMax: null,
        excludeKeywords: [],
        isActive: true,
      };
      const jobs = [{ id: 'job-1', title: 'Développeur React', city: 'Dakar' }];
      (prisma.alert.findUnique as jest.Mock).mockResolvedValue(alert);
      (prisma.job.findMany as jest.Mock).mockResolvedValue(jobs);

      const result = await service.findMatchingJobs('alert-1');

      expect(result).toEqual(jobs);
      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
      );
    });

    it('lève NotFoundException si l\'alerte n\'existe pas', async () => {
      (prisma.alert.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findMatchingJobs('unknown-alert')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('respecte la limite de résultats passée en paramètre', async () => {
      (prisma.alert.findUnique as jest.Mock).mockResolvedValue({
        id: 'a1', keywords: [], locations: [], jobTypes: [], workModes: [],
        salaryMin: null, salaryMax: null, excludeKeywords: [],
      });
      (prisma.job.findMany as jest.Mock).mockResolvedValue([]);

      await service.findMatchingJobs('a1', 5);

      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });

  // ─── toggle() ─────────────────────────────────────────────────────────────

  describe('toggle()', () => {
    it('inverse isActive d\'une alerte', async () => {
      const alert = { id: 'a1', userId: PREMIUM_USER.id, isActive: true };
      (prisma.alert.findFirst as jest.Mock).mockResolvedValue(alert);
      (prisma.alert.update as jest.Mock).mockResolvedValue({ ...alert, isActive: false });

      const result = await service.toggle(PREMIUM_USER.id, 'a1');

      expect(prisma.alert.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { isActive: false },
      });
      expect(result.isActive).toBe(false);
    });

    it('lève NotFoundException si l\'alerte n\'appartient pas à l\'utilisateur', async () => {
      (prisma.alert.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.toggle('wrong-user', 'a1')).rejects.toThrow(NotFoundException);
    });
  });
});

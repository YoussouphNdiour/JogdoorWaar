import { Test, TestingModule } from '@nestjs/testing';
import { SourcePlatform } from '@prisma/client';
import { DeduplicationService } from './deduplication.service';
import { PrismaService } from '../prisma/prisma.service';
import { RawJob } from './interfaces/raw-job.interface';

const mockJob: RawJob = {
  title: 'Développeur React',
  company: 'Orange Sénégal',
  description: 'Description du poste',
  sourceUrl: 'https://emploisenegal.com/offre/123',
  sourcePlatform: SourcePlatform.EMPLOI_SENEGAL,
  publishedAt: new Date('2026-03-01'),
  city: 'Dakar',
};

describe('DeduplicationService', () => {
  let service: DeduplicationService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeduplicationService,
        {
          provide: PrismaService,
          useValue: {
            job: {
              findUnique: jest.fn(),
            },
            $queryRaw: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DeduplicationService>(DeduplicationService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── Niveau 1 — URL exacte ───────────────────────────────────────────────

  describe('Niveau 1 : URL exacte', () => {
    it('retourne true si l\'URL existe déjà', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'existing-id' });

      const result = await service.isDuplicate(mockJob, 'some-fingerprint');

      expect(result).toBe(true);
      expect(prisma.job.findUnique).toHaveBeenCalledWith({
        where: { sourceUrl: mockJob.sourceUrl },
        select: { id: true },
      });
    });

    it('ne vérifie pas le fingerprint si l\'URL matche déjà', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'existing-id' });

      await service.isDuplicate(mockJob, 'fp123');

      // findUnique appelé une seule fois (URL uniquement)
      expect(prisma.job.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Niveau 2 — Fingerprint SHA-256 ─────────────────────────────────────

  describe('Niveau 2 : fingerprint SHA-256', () => {
    it('retourne true si le fingerprint existe', async () => {
      (prisma.job.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)          // L1 miss
        .mockResolvedValueOnce({ id: 'dup' }); // L2 hit

      const result = await service.isDuplicate(mockJob, 'fp-abc');

      expect(result).toBe(true);
      expect(prisma.job.findUnique).toHaveBeenCalledWith({
        where: { fingerprint: 'fp-abc' },
        select: { id: true },
      });
    });

    it('passe au niveau 3 si L1 et L2 ne trouvent rien', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      await service.isDuplicate(mockJob, 'unknown-fp', [0.1, 0.2, 0.3]);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Niveau 3 — Similarité vectorielle ──────────────────────────────────

  describe('Niveau 3 : similarité vectorielle pgvector', () => {
    it('retourne true si un vecteur similaire est trouvé (> 0.95)', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ id: 'vec-dup' }]);

      const result = await service.isDuplicate(mockJob, 'fp-new', [0.1, 0.2]);

      expect(result).toBe(true);
    });

    it('retourne false si aucun vecteur similaire n\'est trouvé', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const result = await service.isDuplicate(mockJob, 'fp-unique', [0.1, 0.2]);

      expect(result).toBe(false);
    });

    it('ne lance pas la requête vectorielle si aucun embedding fourni', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(null);

      await service.isDuplicate(mockJob, 'fp-no-embed');

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('ne lance pas la requête vectorielle si embedding est tableau vide', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(null);

      await service.isDuplicate(mockJob, 'fp-empty', []);

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  // ─── Cas : pas de doublon ────────────────────────────────────────────────

  describe('Pas de doublon', () => {
    it('retourne false quand aucun niveau ne trouve de correspondance', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.isDuplicate(mockJob, 'brand-new-fp');

      expect(result).toBe(false);
    });
  });
});

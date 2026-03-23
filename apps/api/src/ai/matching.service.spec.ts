import { Test, TestingModule } from '@nestjs/testing';
import { MatchingService } from './matching.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { NotFoundException } from '@nestjs/common';

// Mock Anthropic avant l'import du module
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(),
    },
  })),
}));

const mockJob = {
  id: 'job-1',
  title: 'Développeur React Senior',
  company: 'Orange Sénégal',
  description: 'Description du poste React.',
  requiredSkills: ['React', 'TypeScript'],
  embedding: [0.1, 0.2, 0.3],
};

const mockCv = {
  id: 'cv-1',
  userId: 'user-1',
  isDefault: true,
  textContent: 'CV texte du candidat avec React et TypeScript',
  embedding: [0.15, 0.25, 0.35],
  createdAt: new Date(),
};

const mockLlmResponse = {
  llmScore: 80,
  strengths: ['Expertise React', 'TypeScript avancé'],
  gaps: ['Pas de NestJS'],
  recommendation: 'Candidat solide pour ce poste.',
};

describe('MatchingService', () => {
  let service: MatchingService;
  let prisma: jest.Mocked<PrismaService>;
  let aiService: jest.Mocked<AiService>;
  let anthropicCreate: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingService,
        {
          provide: PrismaService,
          useValue: {
            job: { findUnique: jest.fn() },
            userCV: { findFirst: jest.fn() },
            matchScore: { upsert: jest.fn() },
            $queryRaw: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('test-anthropic-key'),
          },
        },
        {
          provide: AiService,
          useValue: {
            logAiUsage: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<MatchingService>(MatchingService);
    prisma = module.get(PrismaService);
    aiService = module.get(AiService);

    // Accéder au mock Anthropic via l'instance privée
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    anthropicCreate = (service as any).anthropic.messages.create as jest.Mock;
    anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(mockLlmResponse) }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });
  });

  afterEach(() => jest.clearAllMocks());

  // ─── computeMatchScore() ──────────────────────────────────────────────────

  describe('computeMatchScore()', () => {
    it('calcule le score hybride quand CV et offre ont des embeddings', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(mockJob);
      (prisma.userCV.findFirst as jest.Mock).mockResolvedValue(mockCv);
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ score: 0.85 }]);
      (prisma.matchScore.upsert as jest.Mock).mockResolvedValue({});

      const result = await service.computeMatchScore('user-1', 'job-1');

      // hybridScore = round((0.85 * 0.6 + (80/100) * 0.4) * 100) = round((0.51 + 0.32) * 100) = 83
      expect(result.score).toBe(83);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('utilise uniquement le score LLM quand les embeddings sont absents', async () => {
      const jobWithoutEmbedding = { ...mockJob, embedding: null };
      const cvWithoutEmbedding = { ...mockCv, embedding: null };
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(jobWithoutEmbedding);
      (prisma.userCV.findFirst as jest.Mock).mockResolvedValue(cvWithoutEmbedding);
      (prisma.matchScore.upsert as jest.Mock).mockResolvedValue({});

      const result = await service.computeMatchScore('user-1', 'job-1');

      // vectorScore = 0, hybridScore = round((0 * 0.6 + 0.8 * 0.4) * 100) = 32
      expect(result.score).toBe(32);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('upsert le score dans la table MatchScore', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(mockJob);
      (prisma.userCV.findFirst as jest.Mock).mockResolvedValue(mockCv);
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ score: 0.7 }]);
      (prisma.matchScore.upsert as jest.Mock).mockResolvedValue({});

      await service.computeMatchScore('user-1', 'job-1');

      expect(prisma.matchScore.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_jobId: { userId: 'user-1', jobId: 'job-1' } },
        }),
      );
    });

    it('lève NotFoundException si l\'offre n\'existe pas', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.computeMatchScore('user-1', 'unknown-job')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lève NotFoundException si l\'utilisateur n\'a pas de CV', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(mockJob);
      (prisma.userCV.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.computeMatchScore('user-no-cv', 'job-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('retourne les strengths et gaps du LLM dans le résultat', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(mockJob);
      (prisma.userCV.findFirst as jest.Mock).mockResolvedValue(mockCv);
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ score: 0.5 }]);
      (prisma.matchScore.upsert as jest.Mock).mockResolvedValue({});

      const result = await service.computeMatchScore('user-1', 'job-1');

      expect(result.strengths).toEqual(mockLlmResponse.strengths);
      expect(result.gaps).toEqual(mockLlmResponse.gaps);
      expect(result.recommendation).toBe(mockLlmResponse.recommendation);
    });

    it('gère gracieusement une réponse LLM invalide (JSON malformé)', async () => {
      anthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'pas du JSON valide' }],
        usage: { input_tokens: 50, output_tokens: 10 },
      });
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(mockJob);
      (prisma.userCV.findFirst as jest.Mock).mockResolvedValue(mockCv);
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ score: 0.5 }]);
      (prisma.matchScore.upsert as jest.Mock).mockResolvedValue({});

      const result = await service.computeMatchScore('user-1', 'job-1');

      // llmScore fallback = 0 → hybridScore = round((0.5 * 0.6 + 0) * 100) = 30
      expect(result.score).toBe(30);
      expect(result.strengths).toEqual([]);
    });

    it('logue l\'utilisation IA après le calcul', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(mockJob);
      (prisma.userCV.findFirst as jest.Mock).mockResolvedValue(mockCv);
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ score: 0.7 }]);
      (prisma.matchScore.upsert as jest.Mock).mockResolvedValue({});

      await service.computeMatchScore('user-1', 'job-1');

      expect(aiService.logAiUsage).toHaveBeenCalledWith(
        'user-1',
        'MATCHING',
        expect.objectContaining({ input_tokens: 100, output_tokens: 50 }),
      );
    });
  });
});

import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PdfExtractorService } from './pdf-extractor.service';
import { EmbeddingService } from './embedding.service';
import { StorageService } from './storage.service';
import { UploadCvDto } from './dto/upload-cv.dto';
import { UpdateCvDto } from './dto/update-cv.dto';
import { CvAnalysis } from './interfaces/cv-analysis.interface';
import { UserCV } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';

/** Anthropic model — must remain exact. */
const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

@Injectable()
export class CvsService {
  private readonly logger = new Logger(CvsService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfExtractor: PdfExtractorService,
    private readonly embeddingService: EmbeddingService,
    private readonly storageService: StorageService,
    private readonly config: ConfigService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.getOrThrow<string>('ANTHROPIC_API_KEY'),
    });
  }

  // ─── READ ────────────────────────────────────────────────────────────────

  async findAll(userId: string): Promise<UserCV[]> {
    return this.prisma.userCV.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(userId: string, cvId: string): Promise<UserCV> {
    const cv = await this.prisma.userCV.findFirst({
      where: { id: cvId, userId },
    });

    if (!cv) {
      throw new NotFoundException(`CV introuvable (id: ${cvId})`);
    }

    return cv;
  }

  // ─── UPLOAD ──────────────────────────────────────────────────────────────

  async upload(
    userId: string,
    file: Express.Multer.File,
    dto: UploadCvDto,
  ): Promise<UserCV> {
    // 1. Upload file to Supabase Storage
    const storagePath = `${userId}/${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
    const fileUrl = await this.storageService.upload(
      storagePath,
      file.buffer,
      file.mimetype,
    );

    // 2. Extract text from PDF
    const textContent = await this.pdfExtractor.extract(file.buffer);

    // 3. Generate embedding vector
    const embedding = await this.embeddingService.embed(textContent);

    // 4. Analyse with Claude: detect skills, job types, sector fit
    const analysis = await this.analyseWithClaude(userId, textContent);

    // 5. Check if this is the user's first CV (will become default)
    const existingCount = await this.prisma.userCV.count({ where: { userId } });
    const isDefault = existingCount === 0;

    // 6. Persist CV record
    const cv = await this.prisma.userCV.create({
      data: {
        userId,
        name: dto.name,
        label: dto.label,
        description: dto.description,
        fileUrl,
        fileName: file.originalname,
        fileSize: file.size,
        textContent,
        // pgvector requires a raw SQL cast; we use $executeRaw after create
        detectedSkills: analysis.detectedSkills,
        detectedJobTypes: analysis.detectedJobTypes,
        sectorFit: analysis.sectorFit,
        isDefault,
      },
    });

    // 7. Persist the embedding via raw SQL (pgvector unsupported type)
    await this.prisma.$executeRaw`
      UPDATE "UserCV"
      SET embedding = ${`[${embedding.join(',')}]`}::vector
      WHERE id = ${cv.id}
    `;

    this.logger.log(`CV créé: ${cv.id} pour user: ${userId}`);
    return cv;
  }

  // ─── UPDATE ──────────────────────────────────────────────────────────────

  async update(
    userId: string,
    cvId: string,
    dto: UpdateCvDto,
  ): Promise<UserCV> {
    await this.findOne(userId, cvId); // ownership check

    return this.prisma.userCV.update({
      where: { id: cvId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });
  }

  // ─── DELETE ──────────────────────────────────────────────────────────────

  async delete(userId: string, cvId: string): Promise<void> {
    await this.findOne(userId, cvId); // ownership check

    const count = await this.prisma.userCV.count({ where: { userId } });
    if (count <= 1) {
      throw new ForbiddenException(
        "Impossible de supprimer votre unique CV. Uploadez-en un autre d'abord.",
      );
    }

    await this.prisma.userCV.delete({ where: { id: cvId } });
    this.logger.log(`CV supprimé: ${cvId}`);
  }

  // ─── SET DEFAULT ─────────────────────────────────────────────────────────

  async setDefault(userId: string, cvId: string): Promise<UserCV> {
    await this.findOne(userId, cvId); // ownership check

    // Reset all CVs for this user, then mark the target as default
    await this.prisma.$transaction([
      this.prisma.userCV.updateMany({
        where: { userId },
        data: { isDefault: false },
      }),
      this.prisma.userCV.update({
        where: { id: cvId },
        data: { isDefault: true },
      }),
    ]);

    return this.findOne(userId, cvId);
  }

  // ─── ANALYSIS ────────────────────────────────────────────────────────────

  async getAnalysis(userId: string, cvId: string): Promise<CvAnalysis> {
    const cv = await this.findOne(userId, cvId);
    const analysis = await this.analyseWithClaude(userId, cv.textContent);

    return {
      cvId,
      ...analysis,
    };
  }

  // ─── MATCH SCORE ─────────────────────────────────────────────────────────

  async getMatchScore(
    userId: string,
    cvId: string,
    jobId: string,
  ): Promise<{ score: number }> {
    await this.findOne(userId, cvId); // ownership check

    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException(`Offre introuvable (id: ${jobId})`);

    // Cosine similarity via pgvector: 1 - cosine_distance
    const result = await this.prisma.$queryRaw<{ score: number }[]>`
      SELECT
        1 - (
          cv.embedding <=> j.embedding
        ) AS score
      FROM "UserCV" cv,
           "Job" j
      WHERE cv.id   = ${cvId}
        AND j.id    = ${jobId}
        AND cv.embedding IS NOT NULL
        AND j.embedding  IS NOT NULL
    `;

    const score = result[0]?.score ?? 0;
    return { score: Math.max(0, Math.min(1, score)) };
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────────────────────────

  private async analyseWithClaude(
    userId: string,
    textContent: string,
  ): Promise<Omit<CvAnalysis, 'cvId'>> {
    const truncated = textContent.slice(0, 6_000);

    const systemPrompt = `Tu es un expert RH spécialisé sur le marché de l'emploi sénégalais.
Analyse le CV fourni et retourne un objet JSON strict, sans markdown, avec cette structure exacte :
{
  "detectedSkills": string[],
  "detectedJobTypes": string[],
  "sectorFit": string[],
  "globalScore": number (0-100),
  "strengths": string[],
  "gaps": string[],
  "recommendation": string
}
- detectedSkills : compétences techniques et soft skills détectées (max 15)
- detectedJobTypes : types de poste correspondants parmi CDI, CDD, STAGE, ALTERNANCE, FREELANCE, TEMPS_PARTIEL
- sectorFit : secteurs d'activité adaptés (max 5, en français)
- globalScore : score global du CV de 0 à 100
- strengths : 3-5 points forts
- gaps : 2-4 lacunes ou axes d'amélioration
- recommendation : synthèse en 1-2 phrases
Réponds UNIQUEMENT avec le JSON, sans texte additionnel.`;

    const message = await this.anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 800,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Voici le contenu du CV à analyser :\n\n${truncated}`,
        },
      ],
    });

    // Log AI usage
    await this.logAiUsage(userId, 'CV_ANALYSIS', {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    });

    const rawText =
      message.content[0]?.type === 'text' ? message.content[0].text : '';

    try {
      const parsed = JSON.parse(rawText) as Omit<CvAnalysis, 'cvId'>;
      return parsed;
    } catch {
      this.logger.error('Claude CV analysis: invalid JSON response', rawText);
      // Return a safe fallback so the upload does not fail
      return {
        detectedSkills: [],
        detectedJobTypes: [],
        sectorFit: [],
        globalScore: 0,
        strengths: [],
        gaps: [],
        recommendation: 'Analyse automatique indisponible.',
      };
    }
  }

  private async logAiUsage(
    userId: string,
    feature: string,
    usage: { input_tokens: number; output_tokens: number },
  ): Promise<void> {
    try {
      await this.prisma.aiUsageLog.create({
        data: {
          userId,
          feature,
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          model: ANTHROPIC_MODEL,
        },
      });
    } catch (err) {
      this.logger.warn('Failed to log AI usage', err);
    }
  }
}

import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from '../cvs/embedding.service';
import { StorageService } from '../cvs/storage.service';
import { AiService } from './ai.service';
import { UserCV } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';

/** Anthropic model — must remain exact. */
const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

@Injectable()
export class CvSelectorService {
  private readonly logger = new Logger(CvSelectorService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly embeddingService: EmbeddingService,
    private readonly storageService: StorageService,
    private readonly aiService: AiService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.getOrThrow<string>('ANTHROPIC_API_KEY'),
    });
  }

  // ─── SELECT BEST CV ──────────────────────────────────────────────────────

  /**
   * Selects the user's CV that best matches the given job offer using
   * pgvector cosine similarity. Falls back to the default CV if embeddings
   * are unavailable.
   */
  async selectBestCv(
    userId: string,
    jobId: string,
  ): Promise<{ cv: UserCV; score: number }> {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException(`Offre introuvable (id: ${jobId})`);

    const cvs = await this.prisma.userCV.findMany({ where: { userId } });
    if (!cvs.length) {
      throw new NotFoundException(
        'Aucun CV trouvé. Uploadez un CV pour utiliser la sélection automatique.',
      );
    }

    if (!job.embedding) {
      // No job embedding — return default CV
      const defaultCv =
        cvs.find((c) => c.isDefault) ?? cvs[cvs.length - 1];
      return { cv: defaultCv, score: 0 };
    }

    // Rank all CVs of this user against the job via pgvector
    const results = await this.prisma.$queryRaw<
      { id: string; score: number }[]
    >`
      SELECT
        cv.id,
        1 - (cv.embedding <=> j.embedding) AS score
      FROM "UserCV" cv,
           "Job"   j
      WHERE cv."userId" = ${userId}
        AND j.id        = ${jobId}
        AND cv.embedding IS NOT NULL
      ORDER BY score DESC
      LIMIT 1
    `;

    if (!results.length) {
      const defaultCv = cvs.find((c) => c.isDefault) ?? cvs[cvs.length - 1];
      return { cv: defaultCv, score: 0 };
    }

    const best = results[0];
    const bestCv = cvs.find((c) => c.id === best.id) ?? cvs[0];

    return {
      cv: bestCv,
      score: Math.max(0, Math.min(1, best.score)),
    };
  }

  // ─── GENERATE ADAPTED CV ─────────────────────────────────────────────────

  /**
   * Generates a tailored version of the base CV for a specific job offer:
   *  1. Rewrites the CV text using Claude
   *  2. Converts the adapted text to a PDF-like text blob
   *  3. Uploads to Supabase Storage
   *  4. Generates embedding for the new content
   *  5. Persists the new UserCV record as a variant of the base CV
   */
  async generateAdaptedCv(
    userId: string,
    jobId: string,
    baseCvId: string,
  ): Promise<UserCV> {
    const [job, baseCv] = await Promise.all([
      this.prisma.job.findUnique({ where: { id: jobId } }),
      this.prisma.userCV.findFirst({ where: { id: baseCvId, userId } }),
    ]);

    if (!job) throw new NotFoundException(`Offre introuvable (id: ${jobId})`);
    if (!baseCv)
      throw new NotFoundException(`CV de base introuvable (id: ${baseCvId})`);

    // ── 1. Rewrite CV with Claude ─────────────────────────────────────────
    const message = await this.anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1_500,
      system: `Tu es un expert en optimisation de CV pour le marché de l'emploi sénégalais.
Adapte le CV fourni pour qu'il corresponde au mieux à l'offre d'emploi.
- Réorganise les compétences pour mettre en avant celles requises par l'offre
- Reformule les expériences pour les aligner avec les besoins du poste
- Conserve toutes les informations factuelles (dates, employeurs, diplômes)
- Ne fabrique aucune compétence ou expérience inexistante
- Retourne uniquement le texte du CV adapté, en français, sans markdown.`,
      messages: [
        {
          role: 'user',
          content: `OFFRE :\nTitre: ${job.title}\nEntreprise: ${job.company}\nCompétences requises: ${job.requiredSkills.join(', ')}\nDescription: ${job.description.slice(0, 1_500)}\n\nCV ORIGINAL :\n${baseCv.textContent.slice(0, 4_000)}`,
        },
      ],
    });

    await this.aiService.logAiUsage(userId, 'CV_GENERATION', {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    });

    const adaptedText =
      message.content[0]?.type === 'text'
        ? message.content[0].text
        : baseCv.textContent;

    // ── 2. Upload adapted text as a plain-text blob ───────────────────────
    const fileName = `cv-adapte-${job.title.replace(/\s+/g, '-').slice(0, 40)}.txt`;
    const storagePath = `${userId}/generated/${Date.now()}_${fileName}`;
    const buffer = Buffer.from(adaptedText, 'utf-8');
    const fileUrl = await this.storageService.upload(
      storagePath,
      buffer,
      'text/plain',
    );

    // ── 3. Generate embedding ─────────────────────────────────────────────
    const embedding = await this.embeddingService.embed(adaptedText);

    // ── 4. Analyse skills ─────────────────────────────────────────────────
    const skillsMsg = await this.anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 300,
      system: `Extrait les compétences du texte de CV. Retourne un JSON strict : { "skills": string[] }. Max 12 compétences. UNIQUEMENT le JSON.`,
      messages: [{ role: 'user', content: adaptedText.slice(0, 3_000) }],
    });

    await this.aiService.logAiUsage(userId, 'CV_GENERATION', {
      input_tokens: skillsMsg.usage.input_tokens,
      output_tokens: skillsMsg.usage.output_tokens,
    });

    let detectedSkills: string[] = [];
    try {
      const parsed = JSON.parse(
        skillsMsg.content[0]?.type === 'text' ? skillsMsg.content[0].text : '{}',
      ) as { skills: string[] };
      detectedSkills = parsed.skills ?? [];
    } catch {
      detectedSkills = baseCv.detectedSkills;
    }

    // ── 5. Persist adapted CV ─────────────────────────────────────────────
    const adaptedCv = await this.prisma.userCV.create({
      data: {
        userId,
        name: `${baseCv.name} — adapté pour ${job.title}`,
        label: `Adapté ${job.company.slice(0, 12)}`,
        description: `CV généré automatiquement par IA pour l'offre "${job.title}" chez ${job.company}`,
        fileUrl,
        fileName,
        fileSize: buffer.byteLength,
        textContent: adaptedText,
        detectedSkills,
        detectedJobTypes: baseCv.detectedJobTypes,
        sectorFit: baseCv.sectorFit,
        isDefault: false,
        isGenerated: true,
        parentCvId: baseCv.id,
      },
    });

    // ── 6. Persist embedding via raw SQL ──────────────────────────────────
    await this.prisma.$executeRaw`
      UPDATE "UserCV"
      SET embedding = ${`[${embedding.join(',')}]`}::vector
      WHERE id = ${adaptedCv.id}
    `;

    this.logger.log(
      `CV adapté créé: ${adaptedCv.id} (base: ${baseCvId}, job: ${jobId})`,
    );

    return adaptedCv;
  }
}

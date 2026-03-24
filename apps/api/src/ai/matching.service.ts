import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from './ai.service';
import { MatchResult } from './interfaces/match-result.interface';
import Anthropic from '@anthropic-ai/sdk';

/** Anthropic model — must remain exact. */
const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

/** Hybrid score weights. */
const VECTOR_WEIGHT = 0.6;
const LLM_WEIGHT = 0.4;

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly aiService: AiService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.getOrThrow<string>('ANTHROPIC_API_KEY'),
    });
  }

  /**
   * Computes a hybrid match score for the user's default CV against a given job.
   *
   * Algorithm:
   *   hybridScore = (vectorScore * 0.6 + llmScore * 0.4)
   *
   * The result is upserted into the MatchScore table and returned.
   */
  async computeMatchScore(
    userId: string,
    jobId: string,
  ): Promise<MatchResult> {
    // ── 1. Fetch job ────────────────────────────────────────────────────
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException(`Offre introuvable (id: ${jobId})`);

    // ── 2. Fetch user's default CV (fallback: most recent CV) ───────────
    const cv =
      (await this.prisma.userCV.findFirst({
        where: { userId, isDefault: true },
      })) ??
      (await this.prisma.userCV.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }));

    if (!cv) {
      throw new NotFoundException(
        'Aucun CV trouvé. Uploadez un CV pour accéder au matching.',
      );
    }

    // ── 3. Vector score via pgvector cosine similarity ──────────────────
    let vectorScore = 0;

    // embedding is Unsupported("vector") — omitted from Prisma types but present in DB.
    // The SQL returns NULL (→ 0) when either embedding is missing, so no guard needed.
    const result = await this.prisma.$queryRaw<{ score: number }[]>`
      SELECT
        1 - (
          cv.embedding <=> j.embedding
        ) AS score
      FROM "UserCV" cv,
           "Job" j
      WHERE cv.id = ${cv.id}
        AND j.id  = ${jobId}
        AND cv.embedding IS NOT NULL
        AND j.embedding  IS NOT NULL
    `;
    vectorScore = Math.max(0, Math.min(1, result[0]?.score ?? 0));

    // ── 4. LLM qualitative score ─────────────────────────────────────────
    const llmResult = await this.scoreLlm(userId, cv.textContent, job);

    // ── 5. Hybrid score (normalised 0–100) ──────────────────────────────
    const hybridScore = Math.round(
      (vectorScore * VECTOR_WEIGHT + (llmResult.llmScore / 100) * LLM_WEIGHT) *
        100,
    );

    const matchResult: MatchResult = {
      score: hybridScore,
      strengths: llmResult.strengths,
      gaps: llmResult.gaps,
      recommendation: llmResult.recommendation,
      vectorScore,
      llmScore: llmResult.llmScore,
    };

    // ── 6. Upsert MatchScore ─────────────────────────────────────────────
    await this.prisma.matchScore.upsert({
      where: { userId_jobId: { userId, jobId } },
      create: {
        userId,
        jobId,
        score: hybridScore,
        reasoning: JSON.stringify({
          strengths: llmResult.strengths,
          gaps: llmResult.gaps,
          recommendation: llmResult.recommendation,
        }),
      },
      update: {
        score: hybridScore,
        reasoning: JSON.stringify({
          strengths: llmResult.strengths,
          gaps: llmResult.gaps,
          recommendation: llmResult.recommendation,
        }),
      },
    });

    this.logger.debug(
      `Match score: user=${userId}, job=${jobId}, hybrid=${hybridScore} (vec=${vectorScore.toFixed(3)}, llm=${llmResult.llmScore})`,
    );

    return matchResult;
  }

  // ─── PRIVATE ────────────────────────────────────────────────────────────

  private async scoreLlm(
    userId: string,
    cvText: string,
    job: { id: string; title: string; company: string; description: string; requiredSkills: string[] },
  ): Promise<{
    llmScore: number;
    strengths: string[];
    gaps: string[];
    recommendation: string;
  }> {
    const message = await this.anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 600,
      system: `Tu es un expert RH sénégalais. Évalue la correspondance entre un CV et une offre d'emploi.
Retourne un JSON strict (sans markdown) :
{
  "llmScore": number (0-100),
  "strengths": string[],     // 3-5 points forts du candidat pour ce poste
  "gaps": string[],          // 2-4 lacunes
  "recommendation": string   // conseil en 1-2 phrases
}
Réponds UNIQUEMENT avec le JSON.`,
      messages: [
        {
          role: 'user',
          content: `OFFRE :\nTitre: ${job.title}\nEntreprise: ${job.company}\nCompétences requises: ${job.requiredSkills.join(', ')}\nDescription: ${job.description.slice(0, 1_500)}\n\nCV:\n${cvText.slice(0, 3_000)}`,
        },
      ],
    });

    await this.aiService.logAiUsage(userId, 'MATCHING', {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    });

    const rawText =
      message.content[0]?.type === 'text' ? message.content[0].text : '{}';

    try {
      return JSON.parse(rawText) as {
        llmScore: number;
        strengths: string[];
        gaps: string[];
        recommendation: string;
      };
    } catch {
      this.logger.error('Matching LLM: invalid JSON response', rawText);
      return {
        llmScore: 0,
        strengths: [],
        gaps: [],
        recommendation: 'Score indisponible.',
      };
    }
  }
}

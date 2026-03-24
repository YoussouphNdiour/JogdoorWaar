import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Plan, UserCV } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import Redis from 'ioredis';
import { CvAnalysis } from '../cvs/interfaces/cv-analysis.interface';

/** Anthropic model — must remain exact. */
const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

/** Cache TTL constants (seconds). */
const TTL_JOB_SUMMARY = 60 * 60 * 24; // 24 h
const TTL_RECOMMENDATIONS = 60 * 60; // 1 h
const TTL_COACHING_SESSION = 60 * 60 * 2; // 2 h

/** Monthly coaching session cap by plan. */
const COACHING_MONTHLY_LIMIT_PREMIUM = 5;

/** Maximum conversation turns per coaching session. */
const COACHING_MAX_TURNS = 10;

interface CoachingSessionMeta {
  turns: number;
  jobId?: string;
  createdAt: number;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly anthropic: Anthropic;
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.getOrThrow<string>('ANTHROPIC_API_KEY'),
    });

    this.redis = new Redis(this.config.getOrThrow<string>('REDIS_URL'), {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
  }

  // ─── JOB SUMMARY ────────────────────────────────────────────────────────

  async summarizeJob(jobId: string): Promise<{ summary: string }> {
    const cacheKey = `ai:job-summary:${jobId}`;

    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) return { summary: cached };

    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException(`Offre introuvable (id: ${jobId})`);

    const message = await this.anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 300,
      system: `Tu es un expert RH sénégalais. Résume cette offre d'emploi en 3-4 phrases percutantes, max 150 mots, en français. Mets en avant le rôle, les compétences clés et la rémunération si disponible. Réponse en texte brut uniquement, pas de markdown.`,
      messages: [
        {
          role: 'user',
          content: `Titre: ${job.title}\nEntreprise: ${job.company}\n\nDescription:\n${job.description.slice(0, 3_000)}`,
        },
      ],
    });

    // Log usage — no userId available here; use system placeholder
    await this.logAiUsage('system', 'JOB_SUMMARY', {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    });

    const summary =
      message.content[0]?.type === 'text' ? message.content[0].text : '';

    // Also persist on the job record
    await this.prisma.job.update({
      where: { id: jobId },
      data: { descriptionShort: summary.slice(0, 500) },
    });

    await this.redis
      .setex(cacheKey, TTL_JOB_SUMMARY, summary)
      .catch(() => null);

    return { summary };
  }

  // ─── COVER LETTER ────────────────────────────────────────────────────────

  async generateCoverLetter(
    userId: string,
    jobId: string,
    cvId?: string,
  ): Promise<{ coverLetter: string }> {
    await this.checkPremiumAccess(userId, 'COVER_LETTER');

    const [job, cv] = await Promise.all([
      this.prisma.job.findUnique({ where: { id: jobId } }),
      this.resolveCv(userId, cvId),
    ]);

    if (!job) throw new NotFoundException(`Offre introuvable (id: ${jobId})`);

    const message = await this.anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 700,
      system: `Tu es un expert en rédaction de lettres de motivation pour le marché de l'emploi sénégalais.
Génère une lettre de motivation professionnelle en français, adaptée au poste et à l'entreprise.
Ton : professionnel mais chaleureux. Structure : accroche (1 §), compétences clés (2 §), motivation (1 §), formule de politesse.
Réponse en texte brut uniquement, sans markdown.`,
      messages: [
        {
          role: 'user',
          content: `OFFRE :\nTitre: ${job.title}\nEntreprise: ${job.company}\nDescription: ${job.description.slice(0, 2_000)}\n\nCV DU CANDIDAT :\n${cv.textContent.slice(0, 3_000)}`,
        },
      ],
    });

    await this.logAiUsage(userId, 'COVER_LETTER', {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    });

    const coverLetter =
      message.content[0]?.type === 'text' ? message.content[0].text : '';

    return { coverLetter };
  }

  // ─── CV ANALYSIS ────────────────────────────────────────────────────────

  async analyzeCv(userId: string, cvId: string): Promise<CvAnalysis> {
    await this.checkPremiumAccess(userId, 'CV_ANALYSIS');

    const cv = await this.prisma.userCV.findFirst({
      where: { id: cvId, userId },
    });
    if (!cv) throw new NotFoundException(`CV introuvable (id: ${cvId})`);

    const truncated = cv.textContent.slice(0, 6_000);

    const message = await this.anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 800,
      system: `Tu es un expert RH spécialisé sur le marché de l'emploi sénégalais.
Analyse le CV et retourne un objet JSON strict (sans markdown) :
{
  "detectedSkills": string[],
  "detectedJobTypes": string[],
  "sectorFit": string[],
  "globalScore": number (0-100),
  "strengths": string[],
  "gaps": string[],
  "recommendation": string
}
Réponds UNIQUEMENT avec le JSON.`,
      messages: [
        { role: 'user', content: `CV :\n${truncated}` },
      ],
    });

    await this.logAiUsage(userId, 'CV_ANALYSIS', {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    });

    const rawText =
      message.content[0]?.type === 'text' ? message.content[0].text : '{}';

    try {
      const parsed = JSON.parse(rawText) as Omit<CvAnalysis, 'cvId'>;
      return { cvId, ...parsed };
    } catch {
      this.logger.error('AI CV analysis: invalid JSON', rawText);
      return {
        cvId,
        detectedSkills: cv.detectedSkills,
        detectedJobTypes: cv.detectedJobTypes,
        sectorFit: cv.sectorFit,
        globalScore: 0,
        strengths: [],
        gaps: [],
        recommendation: 'Analyse indisponible.',
      };
    }
  }

  // ─── INTERVIEW KIT ───────────────────────────────────────────────────────

  async generateInterviewKit(
    userId: string,
    jobId: string,
  ): Promise<{
    questions: string[];
    tips: string[];
    companyInsights: string;
    preparation: string;
  }> {
    await this.checkPremiumAccess(userId, 'INTERVIEW_COACH');

    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException(`Offre introuvable (id: ${jobId})`);

    const message = await this.anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1_000,
      system: `Tu es un coach entretien d'embauche expert sur le marché sénégalais.
Génère un kit de préparation structuré en JSON strict (sans markdown) :
{
  "questions": string[],       // 8-10 questions probables
  "tips": string[],            // 5-7 conseils pratiques
  "companyInsights": string,   // analyse brève de l'entreprise
  "preparation": string        // plan de préparation en 3-4 étapes
}
Réponds UNIQUEMENT avec le JSON.`,
      messages: [
        {
          role: 'user',
          content: `Poste: ${job.title}\nEntreprise: ${job.company}\nDescription: ${job.description.slice(0, 2_000)}`,
        },
      ],
    });

    await this.logAiUsage(userId, 'INTERVIEW_COACH', {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    });

    const rawText =
      message.content[0]?.type === 'text' ? message.content[0].text : '{}';

    try {
      return JSON.parse(rawText) as {
        questions: string[];
        tips: string[];
        companyInsights: string;
        preparation: string;
      };
    } catch {
      this.logger.error('AI interview kit: invalid JSON', rawText);
      throw new InternalServerErrorException(
        'Génération du kit entretien indisponible. Veuillez réessayer.',
      );
    }
  }

  // ─── INTERVIEW COACHING (conversationnel) ────────────────────────────────

  private async checkInterviewCoachingQuota(
    userId: string,
    plan: Plan,
  ): Promise<void> {
    if (plan === Plan.RECRUITER) return;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const count = await this.prisma.aiUsageLog.count({
      where: {
        userId,
        feature: 'INTERVIEW_COACHING',
        createdAt: { gte: startOfMonth },
      },
    });

    if (count >= COACHING_MONTHLY_LIMIT_PREMIUM) {
      throw new ForbiddenException(
        `Vous avez atteint la limite de ${COACHING_MONTHLY_LIMIT_PREMIUM} sessions de coaching par mois. ` +
          `Passez au plan RECRUTEUR pour un accès illimité.`,
      );
    }
  }

  async conductInterviewCoaching(
    userId: string,
    dto: {
      jobId?: string;
      userMessage: string;
      conversationHistory: { role: 'user' | 'assistant'; content: string }[];
      sessionId?: string;
    },
  ): Promise<{ message: string; suggestions: string[]; sessionId: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    if (user.plan === Plan.FREE) {
      throw new ForbiddenException(
        'Le Coach entretien IA nécessite un abonnement PREMIUM ou RECRUTEUR.',
      );
    }

    await this.checkInterviewCoachingQuota(userId, user.plan);

    const sessionId = dto.sessionId ?? `coaching:${userId}:${Date.now()}`;
    const sessionKey = `ai:coaching-session:${sessionId}`;

    const rawSession = await this.redis.get(sessionKey).catch(() => null);
    const session: CoachingSessionMeta = rawSession
      ? (JSON.parse(rawSession) as CoachingSessionMeta)
      : { turns: 0, jobId: dto.jobId, createdAt: Date.now() };

    if (session.turns >= COACHING_MAX_TURNS) {
      throw new ForbiddenException(
        `Cette session a atteint la limite de ${COACHING_MAX_TURNS} échanges. ` +
          `Démarrez une nouvelle session pour continuer.`,
      );
    }

    let jobContext = '';
    const resolvedJobId = dto.jobId ?? session.jobId;
    if (resolvedJobId) {
      const job = await this.prisma.job
        .findUnique({
          where: { id: resolvedJobId },
          select: { title: true, company: true, description: true },
        })
        .catch(() => null);

      if (job) {
        jobContext =
          `\n\n## Contexte du poste\n` +
          `Titre : ${job.title}\n` +
          `Entreprise : ${job.company}\n` +
          `Description : ${job.description.slice(0, 1_500)}`;
      }
    }

    const systemPrompt =
      `Tu es un coach entretien d'embauche expert, spécialisé sur le marché sénégalais et ouest-africain. ` +
      `Tu parles exclusivement en français. ` +
      `Tu peux fonctionner dans deux modes selon ce que le candidat demande :\n` +
      `- **Mode simulation** : tu joues le rôle d'un recruteur réaliste et poses des questions d'entretien ` +
      `(comportementales, techniques, situationnelles). Après chaque réponse tu fournis un feedback bref.\n` +
      `- **Mode conseil** : tu donnes des conseils pratiques, des stratégies de réponse (méthode STAR, etc.), ` +
      `adaptés au marché sénégalais et africain.\n\n` +
      `Règles : toujours répondre en français, rester bienveillant et constructif. ` +
      `Terminer chaque réponse par 1 à 3 suggestions concrètes préfixées par "SUGGESTION:".` +
      jobContext;

    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      ...dto.conversationHistory.slice(-(COACHING_MAX_TURNS * 2)),
      { role: 'user', content: dto.userMessage },
    ];

    const aiResponse = await this.anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 600,
      system: systemPrompt,
      messages,
    });

    await this.logAiUsage(userId, 'INTERVIEW_COACHING', {
      input_tokens: aiResponse.usage.input_tokens,
      output_tokens: aiResponse.usage.output_tokens,
    });

    const rawText =
      aiResponse.content[0]?.type === 'text' ? aiResponse.content[0].text : '';

    const suggestions: string[] = [];
    const messageLines: string[] = [];

    for (const line of rawText.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.toUpperCase().startsWith('SUGGESTION:')) {
        const suggestion = trimmed.replace(/^SUGGESTION:\s*/i, '').trim();
        if (suggestion) suggestions.push(suggestion);
      } else {
        messageLines.push(line);
      }
    }

    const updatedSession: CoachingSessionMeta = {
      ...session,
      turns: session.turns + 1,
      jobId: resolvedJobId,
    };
    await this.redis
      .setex(sessionKey, TTL_COACHING_SESSION, JSON.stringify(updatedSession))
      .catch(() => null);

    return { message: messageLines.join('\n').trim(), suggestions, sessionId };
  }

  // ─── RECOMMENDATIONS ────────────────────────────────────────────────────

  async getRecommendations(userId: string): Promise<
    { jobId: string; score: number; title: string; company: string }[]
  > {
    const cacheKey = `ai:reco:${userId}`;

    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) {
      try {
        return JSON.parse(cached) as {
          jobId: string;
          score: number;
          title: string;
          company: string;
        }[];
      } catch {
        // cache corrupt — recompute
      }
    }

    const scores = await this.prisma.matchScore.findMany({
      where: { userId },
      orderBy: { score: 'desc' },
      take: 10,
      include: { job: { select: { title: true, company: true } } },
    });

    const results = scores.map((ms) => ({
      jobId: ms.jobId,
      score: ms.score,
      title: ms.job.title,
      company: ms.job.company,
    }));

    await this.redis
      .setex(cacheKey, TTL_RECOMMENDATIONS, JSON.stringify(results))
      .catch(() => null);

    return results;
  }

  // ─── PREMIUM CHECK ───────────────────────────────────────────────────────

  async checkPremiumAccess(userId: string, feature: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });

    if (!user) throw new NotFoundException('Utilisateur introuvable');

    if (user.plan === Plan.FREE) {
      throw new ForbiddenException(
        `La fonctionnalité "${feature}" nécessite un abonnement PREMIUM ou RECRUTEUR.`,
      );
    }
  }

  // ─── AI USAGE LOGGER ────────────────────────────────────────────────────

  async logAiUsage(
    userId: string,
    feature: string,
    usage: { input_tokens: number; output_tokens: number },
  ): Promise<void> {
    try {
      // 'system' userId is used for anonymous/background calls
      if (userId !== 'system') {
        await this.prisma.aiUsageLog.create({
          data: {
            userId,
            feature,
            inputTokens: usage.input_tokens,
            outputTokens: usage.output_tokens,
            model: ANTHROPIC_MODEL,
          },
        });
      }
    } catch (err) {
      this.logger.warn('Failed to log AI usage', err);
    }
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────────────────

  private async resolveCv(userId: string, cvId?: string): Promise<UserCV> {
    const where = cvId
      ? { id: cvId, userId }
      : { userId, isDefault: true };

    const cv = await this.prisma.userCV.findFirst({ where });

    if (!cv) {
      throw new NotFoundException(
        cvId
          ? `CV introuvable (id: ${cvId})`
          : "Aucun CV par défaut configuré. Uploadez un CV d'abord.",
      );
    }

    return cv;
  }
}

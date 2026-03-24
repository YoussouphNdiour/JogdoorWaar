import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AiService } from './ai.service';
import { MatchingService } from './matching.service';
import { CvSelectorService } from './cv-selector.service';
import { CoverLetterDto } from './dto/cover-letter.dto';
import { CvAnalysisDto } from './dto/cv-analysis.dto';
import { InterviewCoachDto } from './dto/interview-coach.dto';
import { SelectCvDto } from './dto/select-cv.dto';
import { GenerateAdaptedCvDto } from './dto/generate-adapted-cv.dto';
import { InterviewCoachingDto } from './dto/interview-coaching.dto';

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly matchingService: MatchingService,
    private readonly cvSelectorService: CvSelectorService,
  ) {}

  // ─── GET /ai/match/:jobId ─────────────────────────────────────────────

  @Get('match/:jobId')
  @ApiOperation({ summary: 'Score de matching hybride (60% vectoriel + 40% LLM) user ↔ offre' })
  @ApiParam({ name: 'jobId', description: "ID de l'offre" })
  computeMatch(
    @CurrentUser() user: JwtPayload,
    @Param('jobId') jobId: string,
  ) {
    return this.matchingService.computeMatchScore(user.sub, jobId);
  }

  // ─── GET /ai/recommendations ──────────────────────────────────────────

  @Get('recommendations')
  @ApiOperation({ summary: 'Top 10 recommandations personnalisées (cache Redis 1h)' })
  getRecommendations(@CurrentUser() user: JwtPayload) {
    return this.aiService.getRecommendations(user.sub);
  }

  // ─── GET /ai/job-summary/:jobId ───────────────────────────────────────

  @Get('job-summary/:jobId')
  @ApiOperation({ summary: "Résumé IA de l'offre (cache Redis 24h)" })
  @ApiParam({ name: 'jobId', description: "ID de l'offre" })
  jobSummary(@Param('jobId') jobId: string) {
    return this.aiService.summarizeJob(jobId);
  }

  // ─── POST /ai/cover-letter ────────────────────────────────────────────

  @Post('cover-letter')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Génère une lettre de motivation (PREMIUM)' })
  generateCoverLetter(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CoverLetterDto,
  ) {
    return this.aiService.generateCoverLetter(user.sub, dto.jobId, dto.cvId);
  }

  // ─── POST /ai/cv-analysis ─────────────────────────────────────────────

  @Post('cv-analysis')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Analyse détaillée d'un CV par IA (PREMIUM)" })
  analyzeCv(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CvAnalysisDto,
  ) {
    return this.aiService.analyzeCv(user.sub, dto.cvId);
  }

  // ─── POST /ai/interview-coach ─────────────────────────────────────────

  @Post('interview-coach')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Kit préparation entretien IA (PREMIUM)" })
  generateInterviewKit(
    @CurrentUser() user: JwtPayload,
    @Body() dto: InterviewCoachDto,
  ) {
    return this.aiService.generateInterviewKit(user.sub, dto.jobId);
  }

  // ─── POST /ai/interview-coaching ─────────────────────────────────────

  @Post('interview-coaching')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Coach entretien IA conversationnel — simulation et feedback en temps réel (PREMIUM: 5/mois, RECRUTEUR: illimité)',
  })
  conductInterviewCoaching(
    @CurrentUser() user: JwtPayload,
    @Body() dto: InterviewCoachingDto,
  ) {
    return this.aiService.conductInterviewCoaching(user.sub, {
      jobId: dto.jobId,
      userMessage: dto.userMessage,
      conversationHistory: dto.conversationHistory,
      sessionId: dto.sessionId,
    });
  }

  // ─── POST /ai/select-cv ───────────────────────────────────────────────

  @Post('select-cv')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sélectionne le meilleur CV pour une offre (vectoriel)' })
  selectCv(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SelectCvDto,
  ) {
    return this.cvSelectorService.selectBestCv(user.sub, dto.jobId);
  }

  // ─── POST /ai/generate-adapted-cv ────────────────────────────────────

  @Post('generate-adapted-cv')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Génère un CV adapté pour une offre (PREMIUM)' })
  generateAdaptedCv(
    @CurrentUser() user: JwtPayload,
    @Body() dto: GenerateAdaptedCvDto,
  ) {
    return this.cvSelectorService.generateAdaptedCv(
      user.sub,
      dto.jobId,
      dto.baseCvId ?? '',
    );
  }
}

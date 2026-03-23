import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { JobsService } from './jobs.service';
import { JobFiltersDto } from './dto/job-filters.dto';

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  // ─── GET /jobs ────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List jobs with optional filters and pagination' })
  @ApiOkResponse({ description: 'Paginated list of jobs' })
  findAll(
    @Query() filters: JobFiltersDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.jobsService.findAll(filters, user?.sub);
  }

  // ─── GET /jobs/recommended ────────────────────────────────────────────────

  @Get('recommended')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Top 10 AI-matched jobs for the authenticated user' })
  @ApiOkResponse({ description: 'List of recommended jobs ordered by match score' })
  findRecommended(@CurrentUser() user: JwtPayload) {
    return this.jobsService.findRecommended(user.sub);
  }

  // ─── GET /jobs/search ─────────────────────────────────────────────────────

  @Get('search')
  @ApiOperation({ summary: 'Full-text search via Meilisearch' })
  @ApiOkResponse({ description: 'Search results from Meilisearch' })
  search(
    @Query('q') q: string,
    @Query() filters: JobFiltersDto,
  ) {
    return this.jobsService.search(q ?? '', filters);
  }

  // ─── GET /jobs/saved ──────────────────────────────────────────────────────

  @Get('saved')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List saved (bookmarked) jobs for the authenticated user' })
  @ApiOkResponse({ description: 'List of saved jobs' })
  findSaved(@CurrentUser() user: JwtPayload) {
    return this.jobsService.findSaved(user.sub);
  }

  // ─── GET /jobs/:id ────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get full job detail — increments view count' })
  @ApiParam({ name: 'id', description: 'Job CUID' })
  @ApiOkResponse({ description: 'Job detail object' })
  findById(
    @Param('id') id: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.jobsService.findById(id, user?.sub);
  }

  // ─── GET /jobs/:id/similar ────────────────────────────────────────────────

  @Get(':id/similar')
  @ApiOperation({ summary: 'Find 5 semantically similar jobs via pgvector' })
  @ApiParam({ name: 'id', description: 'Reference job CUID' })
  @ApiOkResponse({ description: 'List of similar jobs' })
  findSimilar(@Param('id') id: string) {
    return this.jobsService.findSimilar(id);
  }

  // ─── POST /jobs/:id/save ──────────────────────────────────────────────────

  @Post(':id/save')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bookmark a job' })
  @ApiParam({ name: 'id', description: 'Job CUID' })
  @ApiNoContentResponse({ description: 'Job saved successfully' })
  async saveJob(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.jobsService.saveJob(user.sub, id);
  }

  // ─── DELETE /jobs/:id/save ────────────────────────────────────────────────

  @Delete(':id/save')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a bookmarked job' })
  @ApiParam({ name: 'id', description: 'Job CUID' })
  @ApiNoContentResponse({ description: 'Job removed from saved list' })
  async unsaveJob(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.jobsService.unsaveJob(user.sub, id);
  }

  // ─── POST /jobs/:id/click ─────────────────────────────────────────────────

  @Post(':id/click')
  @ApiOperation({
    summary: 'Track a click-through and return the original source URL',
  })
  @ApiParam({ name: 'id', description: 'Job CUID' })
  @ApiOkResponse({
    description: 'Source URL for client-side redirect',
    schema: {
      type: 'object',
      properties: { sourceUrl: { type: 'string', format: 'uri' } },
    },
  })
  trackClick(
    @Param('id') id: string,
  ): Promise<{ sourceUrl: string }> {
    return this.jobsService.trackClick(id);
  }
}

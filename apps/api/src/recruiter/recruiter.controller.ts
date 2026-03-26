import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { UserRole } from '@jdw/shared-types';
import { RecruiterService } from './recruiter.service';
import { CreateRecruiterJobDto } from './dto/create-recruiter-job.dto';

@ApiTags('recruiter')
@Controller('recruiter')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.RECRUITER, UserRole.ADMIN, UserRole.SUPERADMIN)
@ApiBearerAuth()
export class RecruiterController {
  constructor(private readonly recruiterService: RecruiterService) {}

  // ─── Stats ────────────────────────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Statistiques du tableau de bord recruteur' })
  @ApiResponse({ status: 200, description: 'Statistiques agrégées' })
  getStats(@CurrentUser() user: JwtPayload) {
    return this.recruiterService.getStats(user.sub);
  }

  // ─── Jobs ─────────────────────────────────────────────────────────────────────

  @Get('jobs')
  @ApiOperation({ summary: 'Lister les offres publiées par le recruteur' })
  @ApiResponse({ status: 200, description: 'Liste des offres' })
  getJobs(@CurrentUser() user: JwtPayload) {
    return this.recruiterService.getJobs(user.sub);
  }

  @Post('jobs')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Publier une nouvelle offre d\'emploi' })
  @ApiResponse({ status: 201, description: 'Offre créée' })
  @ApiResponse({ status: 403, description: 'Limite mensuelle de 10 offres atteinte' })
  createJob(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateRecruiterJobDto,
  ) {
    return this.recruiterService.createJob(user.sub, dto);
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Détail d\'une offre du recruteur' })
  @ApiResponse({ status: 200, description: 'Détail de l\'offre' })
  @ApiResponse({ status: 404, description: 'Offre introuvable' })
  getJob(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.recruiterService.getJob(user.sub, id);
  }

  @Put('jobs/:id')
  @ApiOperation({ summary: 'Mettre à jour une offre (remplacement complet)' })
  @ApiResponse({ status: 200, description: 'Offre mise à jour' })
  @ApiResponse({ status: 404, description: 'Offre introuvable' })
  updateJob(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: Partial<CreateRecruiterJobDto> & { status?: string },
  ) {
    return this.recruiterService.updateJob(user.sub, id, dto);
  }

  @Delete('jobs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une offre' })
  @ApiResponse({ status: 204, description: 'Offre supprimée' })
  @ApiResponse({ status: 404, description: 'Offre introuvable' })
  deleteJob(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.recruiterService.deleteJob(user.sub, id);
  }

  // ─── Applications ─────────────────────────────────────────────────────────────

  @Get('jobs/:id/applications')
  @ApiOperation({ summary: 'Lister les candidatures reçues pour une offre' })
  @ApiResponse({ status: 200, description: 'Liste des candidatures' })
  @ApiResponse({ status: 404, description: 'Offre introuvable' })
  getApplications(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.recruiterService.getApplications(user.sub, id);
  }

  @Patch('jobs/:jobId/applications/:appId')
  @ApiOperation({ summary: 'Mettre à jour le statut d\'une candidature (côté recruteur)' })
  @ApiResponse({ status: 200, description: 'Statut mis à jour' })
  @ApiResponse({ status: 404, description: 'Offre ou candidature introuvable' })
  updateApplicationStatus(
    @CurrentUser() user: JwtPayload,
    @Param('jobId') jobId: string,
    @Param('appId') appId: string,
    @Body('status') status: string,
  ) {
    return this.recruiterService.updateApplicationStatus(user.sub, jobId, appId, status);
  }
}

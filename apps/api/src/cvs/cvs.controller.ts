import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Redirect,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CvsService } from './cvs.service';
import { CvSelectorService } from '../ai/cv-selector.service';
import { UploadCvDto } from './dto/upload-cv.dto';
import { UpdateCvDto } from './dto/update-cv.dto';

const MAX_PDF_SIZE = 5 * 1024 * 1024; // 5 MB

@ApiTags('CVs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cvs')
export class CvsController {
  constructor(
    private readonly cvsService: CvsService,
    private readonly cvSelectorService: CvSelectorService,
  ) {}

  // ─── GET /cvs ──────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Liste tous mes CVs' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.cvsService.findAll(user.sub);
  }

  // ─── POST /cvs/upload ─────────────────────────────────────────────────

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload un CV PDF (max 5 Mo)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'name'],
      properties: {
        file: { type: 'string', format: 'binary' },
        name: { type: 'string' },
        label: { type: 'string' },
        description: { type: 'string' },
      },
    },
  })
  uploadCv(
    @CurrentUser() user: JwtPayload,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_PDF_SIZE }),
          new FileTypeValidator({ fileType: 'application/pdf' }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() dto: UploadCvDto,
  ) {
    return this.cvsService.upload(user.sub, file, dto);
  }

  // ─── PUT /cvs/:id ─────────────────────────────────────────────────────

  @Put(':id')
  @ApiOperation({ summary: 'Met à jour les métadonnées d'un CV' })
  @ApiParam({ name: 'id', description: 'ID du CV' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') cvId: string,
    @Body() dto: UpdateCvDto,
  ) {
    return this.cvsService.update(user.sub, cvId, dto);
  }

  // ─── DELETE /cvs/:id ──────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprime un CV (interdit si dernier CV)' })
  @ApiParam({ name: 'id', description: 'ID du CV' })
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id') cvId: string,
  ): Promise<void> {
    await this.cvsService.delete(user.sub, cvId);
  }

  // ─── PATCH /cvs/:id/set-default ───────────────────────────────────────

  @Patch(':id/set-default')
  @ApiOperation({ summary: 'Définit un CV comme CV par défaut' })
  @ApiParam({ name: 'id', description: 'ID du CV' })
  setDefault(@CurrentUser() user: JwtPayload, @Param('id') cvId: string) {
    return this.cvsService.setDefault(user.sub, cvId);
  }

  // ─── GET /cvs/:id/analysis ────────────────────────────────────────────

  @Get(':id/analysis')
  @ApiOperation({ summary: 'Analyse IA du CV (compétences, secteurs, score)' })
  @ApiParam({ name: 'id', description: 'ID du CV' })
  getAnalysis(@CurrentUser() user: JwtPayload, @Param('id') cvId: string) {
    return this.cvsService.getAnalysis(user.sub, cvId);
  }

  // ─── GET /cvs/:id/download ────────────────────────────────────────────

  @Get(':id/download')
  @Redirect()
  @ApiOperation({ summary: 'Redirige vers l'URL de téléchargement du CV' })
  @ApiParam({ name: 'id', description: 'ID du CV' })
  async download(@CurrentUser() user: JwtPayload, @Param('id') cvId: string) {
    const cv = await this.cvsService.findOne(user.sub, cvId);
    return { url: cv.fileUrl };
  }

  // ─── GET /cvs/:id/match/:jobId ────────────────────────────────────────

  @Get(':id/match/:jobId')
  @ApiOperation({ summary: 'Score de correspondance vectoriel CV ↔ offre' })
  @ApiParam({ name: 'id', description: 'ID du CV' })
  @ApiParam({ name: 'jobId', description: 'ID de l'offre' })
  getMatchScore(
    @CurrentUser() user: JwtPayload,
    @Param('id') cvId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.cvsService.getMatchScore(user.sub, cvId, jobId);
  }

  // ─── POST /cvs/:id/adapt-for-job ──────────────────────────────────────

  @Post(':id/adapt-for-job')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Génère une version adaptée du CV pour une offre (PREMIUM)' })
  @ApiParam({ name: 'id', description: 'ID du CV de base' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['jobId'],
      properties: { jobId: { type: 'string' } },
    },
  })
  adaptForJob(
    @CurrentUser() user: JwtPayload,
    @Param('id') baseCvId: string,
    @Body('jobId') jobId: string,
  ) {
    return this.cvSelectorService.generateAdaptedCv(user.sub, jobId, baseCvId);
  }
}

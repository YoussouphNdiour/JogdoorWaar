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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';

@ApiTags('applications')
@Controller('applications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  @ApiOperation({ summary: 'Lister toutes les candidatures de l\'utilisateur connecté' })
  @ApiResponse({ status: 200, description: 'Liste des candidatures' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.applicationsService.findAll(user.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer une nouvelle candidature' })
  @ApiResponse({ status: 201, description: 'Candidature créée' })
  @ApiResponse({ status: 409, description: 'Candidature déjà existante pour cette offre' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateApplicationDto) {
    return this.applicationsService.create(user.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour une candidature (statut, notes, date d\'entretien)' })
  @ApiResponse({ status: 200, description: 'Candidature mise à jour' })
  @ApiResponse({ status: 404, description: 'Candidature introuvable' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
  ) {
    return this.applicationsService.update(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une candidature' })
  @ApiResponse({ status: 204, description: 'Candidature supprimée' })
  @ApiResponse({ status: 404, description: 'Candidature introuvable' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.applicationsService.remove(user.sub, id);
  }
}

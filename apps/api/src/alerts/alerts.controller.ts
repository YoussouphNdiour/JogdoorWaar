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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'Mes alertes actives' })
  findAll(@CurrentUser() user: { id: string }) {
    return this.alertsService.findAll(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Créer une alerte' })
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateAlertDto) {
    return this.alertsService.create(user.id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Modifier une alerte' })
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateAlertDto,
  ) {
    return this.alertsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer une alerte' })
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.alertsService.remove(user.id, id);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Activer / Désactiver une alerte' })
  toggle(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.alertsService.toggle(user.id, id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Stats : offres trouvées par alerte' })
  getStats(@CurrentUser() user: { id: string }) {
    return this.alertsService.getStats(user.id);
  }
}

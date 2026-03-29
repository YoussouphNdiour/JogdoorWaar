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
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'Mes alertes actives' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.alertsService.findAll(user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Créer une alerte' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateAlertDto) {
    return this.alertsService.create(user.sub, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Modifier une alerte' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAlertDto,
  ) {
    return this.alertsService.update(user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer une alerte' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.alertsService.remove(user.sub, id);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Activer / Désactiver une alerte' })
  toggle(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.alertsService.toggle(user.sub, id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Stats : offres trouvées par alerte' })
  getStats(@CurrentUser() user: JwtPayload) {
    return this.alertsService.getStats(user.sub);
  }
}

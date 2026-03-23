import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  ParseBoolPipe,
  HttpCode,
  HttpStatus,
  Optional,
} from '@nestjs/common';
import { UserRole } from '@jdw/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateJobDto } from './dto/update-job.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─── Platform stats ───────────────────────────────────────────────────────────

  /**
   * GET /admin/stats
   * Accessible to ADMIN and SUPERADMIN.
   */
  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  getPlatformStats() {
    return this.adminService.getPlatformStats();
  }

  // ─── Users ────────────────────────────────────────────────────────────────────

  /**
   * GET /admin/users?page=1&limit=20&search=&plan=&role=
   * Accessible to ADMIN and SUPERADMIN.
   */
  @Get('users')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  getUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('plan') plan?: string,
    @Query('role') role?: string,
  ) {
    return this.adminService.getUsers(page, limit, search, plan, role);
  }

  /**
   * PATCH /admin/users/:id
   * SUPERADMIN only — change plan, role, or isActive flag.
   */
  @Patch('users/:id')
  @Roles(UserRole.SUPERADMIN)
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.adminService.updateUser(id, dto);
  }

  // ─── Jobs ─────────────────────────────────────────────────────────────────────

  /**
   * GET /admin/jobs?page=1&limit=20&sourcePlatform=&isVerified=&isActive=
   * Accessible to ADMIN and SUPERADMIN.
   */
  @Get('jobs')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  getJobs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('sourcePlatform') sourcePlatform?: string,
    @Query('isVerified') isVerifiedRaw?: string,
    @Query('isActive') isActiveRaw?: string,
  ) {
    const isVerified =
      isVerifiedRaw === 'true' ? true : isVerifiedRaw === 'false' ? false : undefined;
    const isActive =
      isActiveRaw === 'true' ? true : isActiveRaw === 'false' ? false : undefined;

    return this.adminService.getJobs(page, limit, sourcePlatform, isVerified, isActive);
  }

  /**
   * PATCH /admin/jobs/:id
   * SUPERADMIN only — verify, activate, or mark as premium.
   */
  @Patch('jobs/:id')
  @Roles(UserRole.SUPERADMIN)
  updateJob(@Param('id') id: string, @Body() dto: UpdateJobDto) {
    return this.adminService.updateJob(id, dto);
  }

  /**
   * DELETE /admin/jobs/:id
   * SUPERADMIN only.
   */
  @Delete('jobs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPERADMIN)
  async deleteJob(@Param('id') id: string): Promise<void> {
    return this.adminService.deleteJob(id);
  }

  // ─── Scraping stats ───────────────────────────────────────────────────────────

  /**
   * GET /admin/scraping/stats
   * Accessible to ADMIN and SUPERADMIN.
   */
  @Get('scraping/stats')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  getScrapingStats() {
    return this.adminService.getScrapingStats();
  }
}

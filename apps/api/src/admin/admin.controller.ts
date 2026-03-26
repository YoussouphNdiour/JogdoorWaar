import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  Logger,
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
  private readonly logger = new Logger(AdminController.name);

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

  // ─── Scrapers (aliases + management) ─────────────────────────────────────────

  /**
   * GET /admin/scrapers
   * Alias of GET /admin/scraping/stats — kept for API compat.
   */
  @Get('scrapers')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  getScrapers() {
    return this.adminService.getScrapers();
  }

  /**
   * POST /admin/scrapers/:platform/run
   * Queue a manual scraper run for the given platform.
   */
  @Post('scrapers/:platform/run')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  runScraper(@Param('platform') platform: string): { queued: boolean } {
    this.logger.log(`Manual scraper run requested for platform: ${platform}`);
    // TODO (Sprint 4): dispatch a BullMQ job to the scraping queue
    return { queued: true };
  }

  /**
   * PATCH /admin/scrapers/:platform/toggle
   * Toggle a scraper's enabled/disabled state.
   */
  @Patch('scrapers/:platform/toggle')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  toggleScraper(
    @Param('platform') platform: string,
    @Body('enabled') enabled: boolean,
  ): { platform: string; enabled: boolean } {
    this.logger.log(`Scraper toggle: platform=${platform} enabled=${enabled}`);
    // TODO (Sprint 4): persist scraper config in a ScraperConfig table
    return { platform, enabled };
  }

  // ─── Subscriptions revenue ────────────────────────────────────────────────────

  /**
   * GET /admin/subscriptions/revenue
   * Monthly revenue breakdown for the last 6 months.
   */
  @Get('subscriptions/revenue')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  getMonthlyRevenue() {
    return this.adminService.getMonthlyRevenue();
  }
}

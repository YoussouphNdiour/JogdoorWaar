import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

/**
 * AdminModule
 *
 * Provides the back-office API used by ADMIN and SUPERADMIN users.
 * PrismaModule is @Global(), so it does not strictly need to be re-imported here,
 * but we declare it explicitly for clarity and to satisfy the DI graph if the
 * global scope is ever removed.
 */
@Module({
  imports: [PrismaModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}

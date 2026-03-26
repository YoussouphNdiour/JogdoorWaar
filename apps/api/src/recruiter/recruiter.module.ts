import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RecruiterController } from './recruiter.controller';
import { RecruiterService } from './recruiter.service';

@Module({
  imports: [PrismaModule],
  controllers: [RecruiterController],
  providers: [RecruiterService],
})
export class RecruiterModule {}

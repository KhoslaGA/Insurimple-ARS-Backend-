import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { HouseholdsController } from './households/households.controller';
import { RenewalsController } from './renewals/renewals.controller';
import { QuotesController } from './quotes/quotes.controller';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController, HouseholdsController, RenewalsController, QuotesController],
})
export class AppModule {}

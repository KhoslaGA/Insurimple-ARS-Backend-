import { Controller, Get, Param } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantId } from '../tenant/tenant.decorator';

@Controller('shops')
export class QuotesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id/results')
  async results(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.quoteResult.findMany({ where: { shopId: id }, orderBy: { respondedAt: 'asc' } }),
    );
  }
}

import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantId } from '../tenant/tenant.decorator';

@Controller('renewals')
export class RenewalsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@TenantId() tenantId: string) {
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.renewalTransaction.findMany({ orderBy: { effectiveDate: 'asc' } }),
    );
  }
}

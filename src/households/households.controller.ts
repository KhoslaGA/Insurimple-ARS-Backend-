import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantId } from '../tenant/tenant.decorator';

@Controller('households')
export class HouseholdsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id')
  async getOne(@TenantId() tenantId: string, @Param('id') id: string) {
    const household = await this.prisma.forTenant(tenantId, (tx) =>
      tx.household.findUnique({ where: { id } }),
    );
    if (!household) throw new NotFoundException('Household not found');
    return household;
  }

  @Get(':id/policies')
  async policies(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.policy.findMany({ where: { householdId: id }, orderBy: { expiresOn: 'asc' } }),
    );
  }
}

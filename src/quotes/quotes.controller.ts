import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantId } from '../tenant/tenant.decorator';
import { parseBody } from '../common/validation';
import { OpenShopSchema, RecordResultSchema } from './dto';

/**
 * quote_shop / quote_result endpoints. Every write is tenant-scoped through
 * PrismaService.forTenant (RLS) and validated at the trust boundary. There is deliberately
 * NO bind / issue endpoint here or anywhere — recording a quote never crosses into binding.
 */
@Controller('shops')
export class QuotesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id/results')
  async results(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.quoteResult.findMany({ where: { shopId: id }, orderBy: { respondedAt: 'asc' } }),
    );
  }

  /** Open a shop: one risk version to be shopped to N carriers. */
  @Post()
  async openShop(@TenantId() tenantId: string, @Body() body: unknown) {
    const input = parseBody(OpenShopSchema, body);
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.quoteShop.create({
        data: {
          tenantId,
          householdId: input.householdId,
          purpose: input.purpose,
          requestedBy: input.requestedBy,
          riskRef: input.riskRef as Prisma.InputJsonValue,
          policyRef: input.policyRef ?? null,
        },
      }),
    );
  }

  /** Record one carrier's response within a shop (Take-All-Comers evidence). */
  @Post(':id/results')
  async recordResult(
    @TenantId() tenantId: string,
    @Param('id') shopId: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(RecordResultSchema, body);
    return this.prisma.forTenant(tenantId, async (tx) => {
      // RLS already blocks cross-tenant writes; a clear 404 beats a foreign-key error.
      const shop = await tx.quoteShop.findUnique({ where: { id: shopId } });
      if (!shop) throw new NotFoundException(`Shop ${shopId} not found.`);
      return tx.quoteResult.create({
        data: {
          tenantId,
          shopId,
          carrierId: input.carrierId,
          carrierName: input.carrierName,
          source: input.source,
          outcome: input.outcome,
          provenance: input.provenance,
          premiumCents: input.premiumCents ?? null,
          coverageVariant: input.coverageVariant ?? null,
          declineReason: input.declineReason ?? null,
          respondedAt: new Date(input.respondedAt),
          presentedToClient: input.presentedToClient,
          simulated: input.simulated,
        },
      });
    });
  }
}

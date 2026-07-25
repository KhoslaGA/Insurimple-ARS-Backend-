import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantId } from '../tenant/tenant.decorator';
import { parseBody } from '../common/validation';
import { RecordOutcomeSchema } from './dto';

@Controller('renewals')
export class RenewalsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@TenantId() tenantId: string) {
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.renewalTransaction.findMany({ orderBy: { effectiveDate: 'asc' } }),
    );
  }

  /**
   * Record a remarket outcome (stay | move | client declined) and complete the renewal.
   * The saved premium is computed server-side — only a move to a cheaper carrier saves —
   * mirroring the contracts recordRemarketOutcome. This records a retention decision; it
   * does not bind a policy.
   */
  @Post(':id/outcome')
  async recordOutcome(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(RecordOutcomeSchema, body);
    return this.prisma.forTenant(tenantId, async (tx) => {
      const renewal = await tx.renewalTransaction.findUnique({ where: { id } });
      if (!renewal) throw new NotFoundException(`Renewal ${id} not found.`);

      const savedCents =
        input.disposition === 'move' && input.chosenPremiumCents != null
          ? renewal.expiringPremiumCents - input.chosenPremiumCents
          : 0;

      // Store the outcome in the contracts RemarketOutcome shape (chosenPremium as Money),
      // so the typed API client round-trips it through RemarketOutcomeSchema on read.
      const outcome: Record<string, unknown> = {
        disposition: input.disposition,
        reason: input.reason,
        decidedAt: input.decidedAt,
        savedCents,
      };
      if (input.chosenCarrier) outcome.chosenCarrier = input.chosenCarrier;
      if (input.chosenPremiumCents != null) {
        outcome.chosenPremium = { currency: 'CAD', amountCents: input.chosenPremiumCents };
      }

      return tx.renewalTransaction.update({
        where: { id },
        data: {
          status: 'completed',
          shopId: input.shopId ?? renewal.shopId,
          outcome: outcome as Prisma.InputJsonValue,
        },
      });
    });
  }
}

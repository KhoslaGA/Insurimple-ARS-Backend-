import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantId } from '../tenant/tenant.decorator';
import { parseBody } from '../common/validation';
import { RecordOutcomeSchema } from './dto';

@Controller('renewals')
export class RenewalsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The renewal queue, each row carrying the display fields the queue actually shows:
   * the household's name and the incumbent carrier. Those live on `household` / `policy`,
   * so they are joined here rather than leaving the UI to render raw ids. Both lookups are
   * inside the same tenant-scoped transaction, so RLS covers them too.
   */
  @Get()
  async list(@TenantId() tenantId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const renewals = await tx.renewalTransaction.findMany({ orderBy: { effectiveDate: 'asc' } });
      if (renewals.length === 0) return [];

      const [households, policies] = await Promise.all([
        tx.household.findMany({
          where: { id: { in: [...new Set(renewals.map((r) => r.householdId))] } },
          select: { id: true, displayName: true },
        }),
        tx.policy.findMany({
          where: { policyNumber: { in: [...new Set(renewals.map((r) => r.policyRef))] } },
          select: { policyNumber: true, carrier: true },
        }),
      ]);

      const nameById = new Map(households.map((h) => [h.id, h.displayName]));
      const carrierByPolicy = new Map(policies.map((p) => [p.policyNumber, p.carrier]));

      return renewals.map((r) => ({
        ...r,
        // Null when the related record isn't in this tenant — the client falls back, never guesses.
        householdName: nameById.get(r.householdId) ?? null,
        incumbentCarrier: carrierByPolicy.get(r.policyRef) ?? null,
      }));
    });
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

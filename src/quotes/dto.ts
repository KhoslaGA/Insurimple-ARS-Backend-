import { z } from 'zod';

/** The exact risk version being shopped (mirrors contracts RiskRef). */
const RiskRefSchema = z.object({
  riskId: z.string().min(1),
  version: z.number().int().positive(),
});

/** POST /shops — open a shopping event for one risk version. */
export const OpenShopSchema = z.object({
  householdId: z.string().min(1),
  purpose: z.enum(['new_business', 'remarket', 'renewal_shop']),
  requestedBy: z.string().min(1),
  riskRef: RiskRefSchema,
  /** For remarket / renewal shops, the existing policy being reshopped. */
  policyRef: z.string().min(1).optional(),
});
export type OpenShopBody = z.infer<typeof OpenShopSchema>;

/**
 * POST /shops/:id/results — record one carrier's response. The cross-field compliance
 * rules are the SAME the contracts quote_result schema enforces, re-checked here because
 * the server must not trust the client: a quoted result carries a premium; a declined or
 * referral result carries a reason and no premium; a simulated result can never be firm.
 * `provenance` (indicative | firm) is a data flag, never a label.
 */
export const RecordResultSchema = z
  .object({
    carrierId: z.string().min(1),
    carrierName: z.string().min(1),
    source: z.enum(['portal', 'rater', 'manual', 'api']),
    outcome: z.enum(['quoted', 'referral', 'declined']),
    provenance: z.enum(['indicative', 'firm']),
    premiumCents: z.number().int().nonnegative().optional(),
    coverageVariant: z.string().min(1).optional(),
    declineReason: z.string().min(1).optional(),
    respondedAt: z.string().datetime(),
    presentedToClient: z.boolean().optional().default(false),
    simulated: z.boolean().optional().default(false),
  })
  .superRefine((r, ctx) => {
    if (r.outcome === 'quoted' && r.premiumCents == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['premiumCents'], message: 'A quoted result must carry a premium.' });
    }
    if (r.outcome !== 'quoted' && r.premiumCents != null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['premiumCents'], message: 'A declined or referral result must not carry a premium.' });
    }
    if (r.outcome !== 'quoted' && !r.declineReason) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['declineReason'], message: 'A declined or referral result must document a reason.' });
    }
    if (r.simulated && r.provenance === 'firm') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['provenance'], message: 'A simulated result can never be firm.' });
    }
  });
export type RecordResultBody = z.infer<typeof RecordResultSchema>;

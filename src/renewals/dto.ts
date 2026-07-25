import { z } from 'zod';

/**
 * POST /renewals/:id/outcome — record a remarket disposition. This is the retention
 * decision (stay | move | client declined), NOT a bind: moving a renewal records that the
 * client chose another carrier's quote, it does not issue a policy. A `move` records the
 * chosen carrier + premium so the server can compute the saved premium.
 */
export const RecordOutcomeSchema = z
  .object({
    disposition: z.enum(['stay', 'move', 'client_declined']),
    chosenCarrier: z.string().min(1).optional(),
    chosenPremiumCents: z.number().int().nonnegative().optional(),
    reason: z.string().min(1),
    decidedAt: z.string().datetime(),
    /** The remarket shop opened for this renewal, if one was. */
    shopId: z.string().min(1).optional(),
  })
  .superRefine((o, ctx) => {
    if (o.disposition === 'move' && o.chosenPremiumCents == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['chosenPremiumCents'], message: 'A move must record the chosen premium.' });
    }
    if (o.disposition === 'move' && !o.chosenCarrier) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['chosenCarrier'], message: 'A move must record the chosen carrier.' });
    }
  });
export type RecordOutcomeBody = z.infer<typeof RecordOutcomeSchema>;

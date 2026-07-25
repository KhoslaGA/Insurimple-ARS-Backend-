import { BadRequestException } from '@nestjs/common';
import type { ZodTypeAny, infer as ZodInfer } from 'zod';

/**
 * Validate a request body at the trust boundary. The server never trusts the client's
 * validation — it re-checks every write with the same zod invariants the domain enforces,
 * so a malformed or non-compliant payload (a quoted result with no premium, a simulated
 * result claiming to be firm) is rejected with a 400 before it can reach the database.
 */
export function parseBody<S extends ZodTypeAny>(schema: S, body: unknown): ZodInfer<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new BadRequestException({
      message: 'Request body failed validation.',
      issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return result.data;
}

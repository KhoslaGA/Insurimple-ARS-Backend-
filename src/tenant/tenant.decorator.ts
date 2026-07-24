import { BadRequestException, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * The tenant for this request. Phase 1 reads `x-tenant-id`; Phase 2 replaces this with
 * the Clerk org claim (tenant context must come from the verified token, NEVER a request
 * param). Whatever the source, it flows into RLS via PrismaService.forTenant.
 */
export const TenantId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<Request>();
  const header = req.headers['x-tenant-id'];
  const tenantId = Array.isArray(header) ? header[0] : header;
  if (!tenantId) {
    throw new BadRequestException('Missing x-tenant-id header (Clerk org-claim wiring is Phase 2).');
  }
  return tenantId;
});

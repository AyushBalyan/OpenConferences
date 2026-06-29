import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RoleKind } from '@openconferences/db';
import type { MembershipRequest } from '../guards/membership.guard';

export const RoleGrants = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RoleKind[] => {
    const request = ctx.switchToHttp().getRequest<MembershipRequest>();
    return request.roleGrants ?? [];
  },
);

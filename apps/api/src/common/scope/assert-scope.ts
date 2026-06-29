import { NotFoundException } from '@nestjs/common';

type ScopedEntity = {
  organizationId?: string | null;
  conferenceId?: string | null;
};

type RouteScope = {
  organizationId?: string;
  conferenceId?: string;
};

/**
 * IDOR prevention helper (§5.3): child resource scope must match route scope.
 * Cross-tenant mismatches return 404 (not 403) to avoid existence leaks.
 */
export function assertScope(entity: ScopedEntity, route: RouteScope): void {
  if (route.conferenceId && entity.conferenceId && entity.conferenceId !== route.conferenceId) {
    throw new NotFoundException('Resource not found');
  }

  if (
    route.organizationId &&
    entity.organizationId &&
    entity.organizationId !== route.organizationId
  ) {
    throw new NotFoundException('Resource not found');
  }
}

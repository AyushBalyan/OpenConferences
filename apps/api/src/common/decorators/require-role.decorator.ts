import { SetMetadata } from '@nestjs/common';
import type { RoleKind } from '@openconferences/db';
import { REQUIRED_ROLES_KEY } from '../guards/guard.constants';

export const RequireRole = (...roles: RoleKind[]) => SetMetadata(REQUIRED_ROLES_KEY, roles);

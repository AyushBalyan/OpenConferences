import { SetMetadata } from '@nestjs/common';
import { REQUIRE_MEMBERSHIP_KEY } from '../guards/guard.constants';

/** Require the user to have a membership in the route scope. */
export const RequireMembership = () => SetMetadata(REQUIRE_MEMBERSHIP_KEY, true);

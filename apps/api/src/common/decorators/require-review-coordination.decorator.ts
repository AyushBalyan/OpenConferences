import {
  CONFERENCE_ORGANIZER_ROLES,
  REVIEW_COORDINATION_ROLES,
} from '../../tenancy/role-hierarchy';
import { RequireRole } from './require-role.decorator';

/** ORG_ADMIN, ORGANIZER, and CHAIR may coordinate reviews (rounds, assignments, bids). */
export const RequireReviewCoordination = () => RequireRole(...REVIEW_COORDINATION_ROLES);

/** ORG_ADMIN and ORGANIZER may manage reviewer invitations and conference review setup. */
export const RequireConferenceOrganizer = () => RequireRole(...CONFERENCE_ORGANIZER_ROLES);

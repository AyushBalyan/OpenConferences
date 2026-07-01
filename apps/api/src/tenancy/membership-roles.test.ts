import { describe, expect, it } from 'vitest';
import { effectiveRolesForConference, mergeRolesByConference } from './membership-roles';
import type { RoleKind } from '@openconferences/db';

describe('mergeRolesByConference', () => {
  it('merges conference and organization roles separately', () => {
    const { rolesByConferenceId, rolesByOrganizationId } = mergeRolesByConference([
      {
        conferenceId: 'conf-1',
        organizationId: 'org-1',
        scope: 'CONFERENCE',
        roles: [{ role: 'AUTHOR' as RoleKind }],
      },
      {
        conferenceId: null,
        organizationId: 'org-1',
        scope: 'ORGANIZATION',
        roles: [{ role: 'ORG_ADMIN' as RoleKind }],
      },
    ]);

    expect(rolesByConferenceId.get('conf-1')).toEqual(['AUTHOR']);
    expect(rolesByOrganizationId.get('org-1')).toEqual(['ORG_ADMIN']);
  });
});

describe('effectiveRolesForConference', () => {
  it('combines conference, organization, and global roles', () => {
    const rolesByConferenceId = new Map<string, RoleKind[]>([['conf-1', ['REVIEWER']]]);
    const rolesByOrganizationId = new Map<string, RoleKind[]>([['org-1', ['ORGANIZER']]]);

    expect(
      effectiveRolesForConference('conf-1', 'org-1', rolesByConferenceId, rolesByOrganizationId, [
        'PLATFORM_ADMIN',
      ]),
    ).toEqual(['REVIEWER', 'ORGANIZER', 'PLATFORM_ADMIN']);
  });
});

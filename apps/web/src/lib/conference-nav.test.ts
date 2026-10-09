import { describe, expect, it } from 'vitest';
import { buildDashboardBreadcrumbs, isNavItemActive, NAV_SECTIONS } from './conference-nav';
const id = 'test-conference';
const options = { conferenceId: id, conferenceName: 'Conference', roles: ['CHAIR'] };
describe('conference navigation', () => {
  it('uses the actual conference ID and analytics route in breadcrumbs', () => {
    expect(buildDashboardBreadcrumbs(`/dashboard/conferences/${id}/analytics`, options)).toEqual([
      { label: 'Conferences', href: '/me/dashboard' },
      { label: 'Conference', href: `/dashboard/conferences/${id}` },
      { label: 'Analytics', href: undefined },
    ]);
  });
  it('does not highlight Overview on analytics or another child route', () => {
    expect(
      isNavItemActive(NAV_SECTIONS.overview, id, `/dashboard/conferences/${id}/analytics`),
    ).toBe(false);
    expect(isNavItemActive(NAV_SECTIONS.overview, id, `/dashboard/conferences/${id}`)).toBe(true);
    expect(
      isNavItemActive(NAV_SECTIONS.analytics, id, `/dashboard/conferences/${id}/analytics`),
    ).toBe(true);
  });
  it('distinguishes reviewer workload from the reviewer directory', () => {
    expect(
      buildDashboardBreadcrumbs(`/dashboard/conferences/${id}/reviews/reviewers`, options).at(-1)
        ?.label,
    ).toBe('Reviewer overview');
    expect(
      buildDashboardBreadcrumbs(`/dashboard/conferences/${id}/members/reviewers`, options).at(-1)
        ?.label,
    ).toBe('Reviewers');
  });
});

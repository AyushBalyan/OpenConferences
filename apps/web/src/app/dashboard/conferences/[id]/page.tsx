'use client';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthorDashboard } from '@/components/dashboard/author-dashboard';
import { OrganizerDashboard } from '@/components/dashboard/organizer-dashboard';
import { ReviewerDashboard } from '@/components/dashboard/reviewer-dashboard';
import { useConferenceWorkspace } from '@/components/dashboard/conference-workspace';
import { isAuthor, isOrganizerSurface, isReviewer } from '@/lib/roles';

export default function ConferenceOverviewPage() {
  const { conferenceId, conference, refresh } = useConferenceWorkspace();

  if (!conference) return null;

  const roles = conference.myRoles ?? [];
  const showAuthor = isAuthor(roles);
  const showReviewer = isReviewer(roles);
  const showOrganizer = isOrganizerSurface(roles);

  if (!showAuthor && !showReviewer && !showOrganizer) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No active roles</CardTitle>
          <CardDescription>
            You do not have author, reviewer, or organizer access for this conference yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-12">
      {showOrganizer ? (
        <OrganizerDashboard
          conferenceId={conferenceId}
          conference={conference}
          roles={roles}
          onRefresh={refresh}
        />
      ) : null}

      {showAuthor ? <AuthorDashboard conferenceId={conferenceId} conference={conference} /> : null}

      {showReviewer ? (
        <ReviewerDashboard conferenceId={conferenceId} conferenceName={conference.name} />
      ) : null}
    </div>
  );
}

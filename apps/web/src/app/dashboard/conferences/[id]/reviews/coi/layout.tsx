'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CoiWorkspaceProvider } from '@/components/dashboard/reviews/coi/coi-workspace';
import { CoiAlerts } from '@/components/dashboard/reviews/coi/coi-panels';
import { useConferenceWorkspace } from '@/components/dashboard/conference-workspace';
import { PageHeader } from '@/components/dashboard/page-header';
import { SectionLayoutFrame } from '@/components/dashboard/section-layout-frame';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { coiSectionMeta } from '@/lib/conference-nav';
import { canCoordinateReview } from '@/lib/roles';
import { REVIEWER_COI_ENABLED, reviewerLandingPath } from '@/lib/reviewer-features';

export default function CoiLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const { conference } = useConferenceWorkspace();
  const roles = conference?.myRoles ?? [];
  const meta = coiSectionMeta(roles);
  const reviewerCoiDisabled =
    Boolean(conference) && !canCoordinateReview(roles) && !REVIEWER_COI_ENABLED;

  if (reviewerCoiDisabled) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Conflicts of interest"
          description="Conflict declaration is turned off for reviewers."
        />
        <Card>
          <CardContent className="space-y-4 py-8 text-center text-muted-foreground">
            <p>
              Reviewer conflict declaration is not available. Open your assigned reviews instead.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href={reviewerLandingPath(params.id)}>My reviews</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <CoiWorkspaceProvider conferenceId={params.id}>
      <SectionLayoutFrame title={meta.title} description={meta.description} alerts={<CoiAlerts />}>
        {children}
      </SectionLayoutFrame>
    </CoiWorkspaceProvider>
  );
}

'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/components/dashboard/data-table';
import { KpiCard, KpiGrid } from '@/components/dashboard/kpi-card';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { WorkflowBadge } from '@/components/dashboard/workflow-badge';
import { fetchAnalyticsOverview, fetchPapers, transitionConferenceStatus } from '@/lib/api-client';
import type { Conference } from '@/lib/conference-types';
import { paperStatusLabel, paperStatusTone } from '@/lib/paper-status-styles';
import type { PaperDto } from '@/lib/submission-types';
import { canCoordinateReview, canManageConference } from '@/lib/roles';
import type { ConferenceAnalyticsOverview } from '@openconferences/schemas';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthorSubmitLinkCard } from '@/components/dashboard/author-submit-link-card';

type OrganizerDashboardProps = {
  conferenceId: string;
  conference: Conference;
  roles: string[];
  onRefresh: () => Promise<void>;
};

export function OrganizerDashboard({
  conferenceId,
  conference,
  roles,
  onRefresh,
}: OrganizerDashboardProps) {
  const [papers, setPapers] = useState<PaperDto[]>([]);
  const [analytics, setAnalytics] = useState<ConferenceAnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const tasks: Promise<void>[] = [];

    if (canCoordinateReview(roles) || canManageConference(roles)) {
      tasks.push(fetchPapers(conferenceId, { limit: 5 }).then((result) => setPapers(result.data)));
    }

    if (canCoordinateReview(roles)) {
      tasks.push(fetchAnalyticsOverview(conferenceId).then(setAnalytics));
    }

    await Promise.all(tasks);
  }, [conferenceId, roles]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Failed to load dashboard');
        setPapers([]);
        setAnalytics(null);
      })
      .finally(() => setLoading(false));
  }, [load]);

  const underReviewCount = useMemo(() => {
    if (analytics) {
      return (
        analytics.submissions.byStatus.find((item) => item.status === 'UNDER_REVIEW')?.count ?? 0
      );
    }
    return papers.filter((paper) => paper.status === 'UNDER_REVIEW').length;
  }, [analytics, papers]);

  const pendingReviews =
    analytics != null
      ? Math.max(analytics.reviews.assigned - analytics.reviews.completed, 0)
      : null;
  const registrationCount = analytics?.registrations.paid ?? null;
  const submissionCount = analytics?.submissions.total ?? papers.length;

  async function openCfp() {
    setActionError(null);
    try {
      await transitionConferenceStatus(conferenceId, 'CFP_OPEN');
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Transition failed');
    }
  }

  return (
    <>
      <PageHeader
        title="Organizer overview"
        description="Bird's-eye view of conference health, bottlenecks, and activity."
        actions={
          canManageConference(roles) ? (
            <Button asChild variant="outline">
              <Link href={`/dashboard/conferences/${conferenceId}/settings`}>Settings</Link>
            </Button>
          ) : undefined
        }
      />

      {loadError ? <p className="mb-4 text-sm text-rose-600">{loadError}</p> : null}
      {actionError ? <p className="mb-4 text-sm text-rose-600">{actionError}</p> : null}

      {canManageConference(roles) ? (
        <AuthorSubmitLinkCard
          conferenceId={conferenceId}
          cfpOpen={conference.status === 'CFP_OPEN'}
        />
      ) : null}

      <KpiGrid className="mb-8">
        <KpiCard
          label="Active submissions"
          value={loading ? '—' : submissionCount}
          hint={`${underReviewCount} under review`}
          loading={loading}
        />
        <KpiCard
          label="Reviews pending"
          value={pendingReviews ?? '—'}
          tone={pendingReviews !== null && pendingReviews > 0 ? 'warning' : 'default'}
          hint="Unsubmitted reviewer assignments"
          loading={loading && canCoordinateReview(roles)}
        />
        <KpiCard
          label="Registrations"
          value={registrationCount ?? '—'}
          hint="Paid registrations"
          loading={loading && canCoordinateReview(roles)}
        />
      </KpiGrid>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-slate-900">Recent submissions</h2>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/dashboard/conferences/${conferenceId}/submissions`}>View all</Link>
              </Button>
            </div>

            {loading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="h-24 animate-pulse rounded-md bg-slate-100" />
                </CardContent>
              </Card>
            ) : papers.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-slate-500">
                  No submissions yet. Publish the CFP to start receiving papers.
                </CardContent>
              </Card>
            ) : (
              <DataTable>
                <DataTableHeader>
                  <tr>
                    <DataTableHead>Title</DataTableHead>
                    <DataTableHead>Status</DataTableHead>
                    <DataTableHead className="text-right">Action</DataTableHead>
                  </tr>
                </DataTableHeader>
                <DataTableBody>
                  {papers.slice(0, 5).map((paper) => (
                    <DataTableRow key={paper.id}>
                      <DataTableCell>
                        <p className="font-medium text-slate-900">{paper.title}</p>
                      </DataTableCell>
                      <DataTableCell>
                        <WorkflowBadge
                          label={paperStatusLabel(paper.status)}
                          tone={paperStatusTone(paper.status)}
                        />
                      </DataTableCell>
                      <DataTableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link
                            href={`/dashboard/conferences/${conferenceId}/submissions/${paper.id}`}
                          >
                            View
                          </Link>
                        </Button>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            )}
          </section>

          {canCoordinateReview(roles) ? (
            <Card>
              <CardHeader>
                <CardTitle>Review coordination</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/conferences/${conferenceId}/reviews/rounds`}>
                    Review rounds
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/conferences/${conferenceId}/reviews/assignments/current`}>
                    Assignments
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/conferences/${conferenceId}/reviews/decisions`}>
                    Decisions
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/conferences/${conferenceId}/analytics`}>Analytics</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/conferences/${conferenceId}/audit`}>Audit log</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Conference status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <StatusBadge status={conference.status} />
              <p className="text-sm text-slate-500">
                Blinding: {conference.blindingMode.replace(/_/g, ' ')}
              </p>
              {canManageConference(roles) && conference.status === 'DRAFT' ? (
                <Button onClick={openCfp} size="sm">
                  Publish CFP
                </Button>
              ) : null}
              {actionError ? <p className="text-sm text-rose-600">{actionError}</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming deadlines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <DeadlineItem
                label="Current phase"
                value={conference.status.replace(/_/g, ' ')}
                urgent={conference.status === 'REVIEWING' || conference.status === 'FINALIZATION'}
              />
              <DeadlineItem label="Conference slug" value={conference.slug} />
            </CardContent>
          </Card>

          {canManageConference(roles) ? (
            <Card>
              <CardHeader>
                <CardTitle>Administration</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/conferences/${conferenceId}/tracks`}>Tracks</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/conferences/${conferenceId}/members`}>Members</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}

function DeadlineItem({
  label,
  value,
  urgent,
}: {
  label: string;
  value: string;
  urgent?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${urgent ? 'bg-amber-500' : 'bg-slate-300'}`}
      />
      <div>
        <p className="text-slate-500">{label}</p>
        <p className="font-medium text-slate-900">{value}</p>
      </div>
    </div>
  );
}

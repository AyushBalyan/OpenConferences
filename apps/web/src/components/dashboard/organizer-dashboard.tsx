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
import {
  fetchAuditLogs,
  fetchPapers,
  fetchRegistrations,
  fetchReviewRounds,
  fetchAssignments,
  transitionConferenceStatus,
} from '@/lib/api-client';
import type { AuditEntry, Conference } from '@/lib/conference-types';
import { paperStatusLabel, paperStatusTone } from '@/lib/paper-status-styles';
import type { PaperDto } from '@/lib/submission-types';
import { canCoordinateReview, canManageConference } from '@/lib/roles';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
  const [pendingReviews, setPendingReviews] = useState<number | null>(null);
  const [registrationCount, setRegistrationCount] = useState<number | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const tasks: Promise<void>[] = [];

    if (canCoordinateReview(roles) || canManageConference(roles)) {
      tasks.push(fetchPapers(conferenceId).then((result) => setPapers(result.data)));
    }

    if (canCoordinateReview(roles)) {
      tasks.push(
        (async () => {
          const rounds = await fetchReviewRounds(conferenceId);
          const activeRound = rounds.find((round) => round.status !== 'CLOSED') ?? rounds[0];
          if (!activeRound) {
            setPendingReviews(0);
            return;
          }
          const assignments = await fetchAssignments(conferenceId, activeRound.id);
          const pending = assignments.filter((item) => item.status !== 'COMPLETED').length;
          setPendingReviews(pending);
        })(),
        fetchRegistrations(conferenceId)
          .then((result) => setRegistrationCount(result.data.length))
          .catch(() => setRegistrationCount(0)),
        fetchAuditLogs(conferenceId)
          .then(setAuditLogs)
          .catch(() => setAuditLogs([])),
      );
    }

    await Promise.all(tasks);
  }, [conferenceId, roles]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => {
        setPapers([]);
        setPendingReviews(null);
        setRegistrationCount(null);
        setAuditLogs([]);
      })
      .finally(() => setLoading(false));
  }, [load]);

  const underReviewCount = useMemo(
    () => papers.filter((paper) => paper.status === 'UNDER_REVIEW').length,
    [papers],
  );

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

      <KpiGrid className="mb-8">
        <KpiCard
          label="Active submissions"
          value={loading ? '—' : papers.length}
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
          hint="Accepted paper registrations"
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
                  {papers.slice(0, 6).map((paper) => (
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

          {canCoordinateReview(roles) ? (
            <Card>
              <CardHeader>
                <CardTitle>Team activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {auditLogs.length === 0 ? (
                  <p className="text-slate-500">No recent audit events.</p>
                ) : (
                  auditLogs.slice(0, 5).map((entry) => (
                    <div key={entry.id} className="border-b border-slate-100 pb-2 last:border-0">
                      <p className="font-medium text-slate-900">
                        {entry.action.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-slate-500">
                        {entry.entity} · {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
                <Button asChild variant="ghost" size="sm" className="px-0">
                  <Link href={`/dashboard/conferences/${conferenceId}/audit`}>View audit log</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

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

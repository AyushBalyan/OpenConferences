'use client';

import Link from 'next/link';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/components/dashboard/data-table';
import { EmptyState } from '@/components/dashboard/empty-state';
import { DashboardConferenceCards } from '@/components/dashboard/dashboard-conference-cards';
import { PageHeader } from '@/components/dashboard/page-header';
import { WorkflowBadge } from '@/components/dashboard/workflow-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchMe, fetchMeDashboard } from '@/lib/api-client';
import { mfaEnrollHref } from '@/lib/mfa-errors';
import { paperStatusLabel, paperStatusTone } from '@/lib/paper-status-styles';
import type { MeDashboard } from '@openconferences/schemas';
import { useEffect, useState } from 'react';

const PREVIEW_LIMIT = 3;

export default function MeDashboardPage() {
  const [dashboard, setDashboard] = useState<MeDashboard | null>(null);
  const [needsMfaEnroll, setNeedsMfaEnroll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchMeDashboard(), fetchMe()])
      .then(([dash, me]) => {
        setDashboard(dash);
        setNeedsMfaEnroll(Boolean(dash.canCreateConference && me && !me.twoFactorEnabled));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const isEmpty =
    dashboard &&
    dashboard.authoredPapers.length === 0 &&
    dashboard.reviewerAssignments.length === 0 &&
    dashboard.authorConferences.length === 0 &&
    dashboard.reviewerConferences.length === 0 &&
    dashboard.organizerConferences.length === 0;

  const papersPreview = dashboard?.authoredPapers.slice(0, PREVIEW_LIMIT) ?? [];
  const assignmentsPreview = dashboard?.reviewerAssignments.slice(0, PREVIEW_LIMIT) ?? [];
  const papersOverflow = (dashboard?.authoredPapers.length ?? 0) - papersPreview.length;
  const assignmentsOverflow =
    (dashboard?.reviewerAssignments.length ?? 0) - assignmentsPreview.length;

  return (
    <>
      <PageHeader
        title="Your dashboard"
        description="Cross-conference summary with links to full workspaces."
      />

      {error ? <p className="mb-4 text-sm text-rose-600">{error}</p> : null}

      {!loading && needsMfaEnroll ? (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Enable email verification for admin actions</p>
          <p className="mt-1 text-amber-900/90">
            Creating conferences and other privileged organizer actions require a one-time code
            emailed to your account.
          </p>
          <Button asChild className="mt-3" size="sm">
            <Link href={mfaEnrollHref('/me/dashboard')}>Enable email verification</Link>
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((key) => (
            <Card key={key}>
              <CardContent className="space-y-3 p-6">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {!loading && isEmpty ? (
        <EmptyState
          icon="inbox"
          title="Nothing to show yet"
          description={
            dashboard?.canCreateConference
              ? 'Create your first conference to start organizing submissions, reviews, and registration.'
              : 'You will see your papers, review assignments, and organizer conferences here once you join a conference.'
          }
          action={
            dashboard?.canCreateConference ? (
              <Button asChild>
                <Link href="/dashboard/conferences/new">Create conference</Link>
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {!loading && dashboard && dashboard.authorConferences.length > 0 ? (
        <section className="mb-10 space-y-4">
          <SectionHeading title="Author conferences" />
          <DashboardConferenceCards
            conferences={dashboard.authorConferences}
            actionLabel="Open submissions"
          />
        </section>
      ) : null}

      {!loading && dashboard && dashboard.reviewerConferences.length > 0 ? (
        <section className="mb-10 space-y-4">
          <SectionHeading title="Reviewer conferences" />
          <DashboardConferenceCards
            conferences={dashboard.reviewerConferences}
            actionLabel="Open reviews"
          />
        </section>
      ) : null}

      {!loading && dashboard && dashboard.authoredPapers.length > 0 ? (
        <section className="mb-10 space-y-4">
          <SectionHeading
            title="Recent submissions"
            overflow={papersOverflow}
            href={
              papersPreview[0]
                ? `/dashboard/conferences/${papersPreview[0].conferenceId}/submissions`
                : undefined
            }
          />
          <DataTable>
            <DataTableHeader>
              <tr>
                <DataTableHead>Title</DataTableHead>
                <DataTableHead>Conference</DataTableHead>
                <DataTableHead>Status</DataTableHead>
                <DataTableHead className="text-right">Action</DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {papersPreview.map((paper) => (
                <DataTableRow key={paper.id}>
                  <DataTableCell>
                    <p className="font-medium text-slate-900">{paper.title}</p>
                  </DataTableCell>
                  <DataTableCell>{paper.conferenceName}</DataTableCell>
                  <DataTableCell>
                    <WorkflowBadge
                      label={paperStatusLabel(paper.status)}
                      tone={paperStatusTone(paper.status)}
                    />
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={`/dashboard/conferences/${paper.conferenceId}/submissions/${paper.id}`}
                      >
                        Open
                      </Link>
                    </Button>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </section>
      ) : null}

      {!loading && dashboard && dashboard.reviewerAssignments.length > 0 ? (
        <section className="mb-10 space-y-4">
          <SectionHeading
            title="Pending reviews"
            overflow={assignmentsOverflow}
            href={
              assignmentsPreview[0]
                ? `/dashboard/conferences/${assignmentsPreview[0].conferenceId}/reviews/my-assignments`
                : undefined
            }
          />
          <DataTable>
            <DataTableHeader>
              <tr>
                <DataTableHead>Paper</DataTableHead>
                <DataTableHead>Conference</DataTableHead>
                <DataTableHead>Due</DataTableHead>
                <DataTableHead className="text-right">Action</DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {assignmentsPreview.map((assignment) => (
                <DataTableRow key={assignment.id}>
                  <DataTableCell>
                    <p className="font-medium text-slate-900">{assignment.paperTitle}</p>
                  </DataTableCell>
                  <DataTableCell>{assignment.conferenceName}</DataTableCell>
                  <DataTableCell className="font-mono text-xs">
                    {assignment.dueAt ? new Date(assignment.dueAt).toLocaleDateString() : '—'}
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    <Button asChild size="sm">
                      <Link
                        href={`/dashboard/conferences/${assignment.conferenceId}/reviews/assignments/${assignment.id}`}
                      >
                        {assignment.status === 'COMPLETED' ? 'View review' : 'Continue review'}
                      </Link>
                    </Button>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </section>
      ) : null}

      {!loading && dashboard && dashboard.organizerConferences.length > 0 ? (
        <section className="space-y-4">
          <SectionHeading title="Organizer conferences" />
          <DashboardConferenceCards conferences={dashboard.organizerConferences} />
        </section>
      ) : null}
    </>
  );
}

function SectionHeading({
  title,
  overflow = 0,
  href,
}: {
  title: string;
  overflow?: number;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-medium text-slate-900">{title}</h2>
        {overflow > 0 ? (
          <p className="text-sm text-slate-500">
            Showing {PREVIEW_LIMIT} of {PREVIEW_LIMIT + overflow}
          </p>
        ) : null}
      </div>
      {href ? (
        <Button asChild variant="ghost" size="sm">
          <Link href={href}>View all</Link>
        </Button>
      ) : null}
    </div>
  );
}

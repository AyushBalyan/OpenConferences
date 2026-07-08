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
import { EmptyState } from '@/components/dashboard/empty-state';
import { KpiCard, KpiGrid } from '@/components/dashboard/kpi-card';
import { PageHeader } from '@/components/dashboard/page-header';
import { WorkflowBadge } from '@/components/dashboard/workflow-badge';
import { fetchPapers } from '@/lib/api-client';
import type { Conference } from '@/lib/conference-types';
import { paperStatusLabel, paperStatusTone } from '@/lib/paper-status-styles';
import type { PaperDto } from '@/lib/submission-types';
import { useCallback, useEffect, useMemo, useState } from 'react';

type AuthorDashboardProps = {
  conferenceId: string;
  conference: Conference;
};

export function AuthorDashboard({ conferenceId, conference }: AuthorDashboardProps) {
  const [papers, setPapers] = useState<PaperDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const result = await fetchPapers(conferenceId, { mine: true });
    setPapers(result.data);
  }, [conferenceId]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => setPapers([]))
      .finally(() => setLoading(false));
  }, [load]);

  const actionRequired = useMemo(
    () =>
      papers.filter((paper) => paper.status === 'DRAFT' || paper.status === 'DECISION_MADE').length,
    [papers],
  );

  const phaseLabel = conference.status.replace(/_/g, ' ');

  return (
    <>
      <PageHeader
        title="Author dashboard"
        description="Track your submissions and required actions for this conference."
        actions={
          <Button asChild>
            <Link href={`/dashboard/conferences/${conferenceId}/submissions/new`}>
              New submission
            </Link>
          </Button>
        }
      />

      <KpiGrid className="mb-8">
        <KpiCard label="My submissions" value={loading ? '—' : papers.length} loading={loading} />
        <KpiCard
          label="Action required"
          value={loading ? '—' : actionRequired}
          tone={actionRequired > 0 ? 'warning' : 'default'}
          hint={actionRequired > 0 ? 'Drafts or post-decision steps pending' : 'All caught up'}
          loading={loading}
        />
        <KpiCard
          label="Conference phase"
          value={phaseLabel}
          hint="Current lifecycle stage"
          loading={loading}
        />
      </KpiGrid>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-slate-900">My papers</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/dashboard/conferences/${conferenceId}/submissions`}>View all</Link>
            </Button>
          </div>

          {loading ? (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {[1, 2].map((key) => (
                    <div key={key} className="h-12 animate-pulse rounded-md bg-slate-100" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : papers.length === 0 ? (
            <EmptyState
              title="No submissions yet"
              description="Submit your first paper when the call for papers is open."
              action={
                <Button asChild>
                  <Link href={`/dashboard/conferences/${conferenceId}/submissions/new`}>
                    Submit your first paper
                  </Link>
                </Button>
              }
            />
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
                {papers.slice(0, 8).map((paper) => (
                  <DataTableRow key={paper.id}>
                    <DataTableCell>
                      <div>
                        <p className="font-medium text-slate-900">{paper.title}</p>
                        <p className="font-mono text-xs text-slate-400">
                          {paper.id.slice(0, 8).toUpperCase()}
                        </p>
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <WorkflowBadge
                        label={paperStatusLabel(paper.status)}
                        tone={paperStatusTone(paper.status)}
                      />
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      <PaperAction paper={paper} conferenceId={conferenceId} />
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Important dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <TimelineItem label="Current phase" value={phaseLabel} active />
              <TimelineItem
                label="Blinding mode"
                value={conference.blindingMode.replace(/_/g, ' ')}
              />
              <TimelineItem
                label="Decision announcements"
                value={
                  conference.status === 'DECISIONS' || conference.status === 'FINALIZATION'
                    ? 'In progress'
                    : 'After review phase'
                }
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}

function PaperAction({ paper, conferenceId }: { paper: PaperDto; conferenceId: string }) {
  const href = `/dashboard/conferences/${conferenceId}/submissions/${paper.id}`;

  if (paper.status === 'DRAFT') {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href={href}>Continue draft</Link>
      </Button>
    );
  }

  if (paper.status === 'DECISION_MADE') {
    return (
      <Button asChild size="sm">
        <Link href={href}>Upload camera-ready</Link>
      </Button>
    );
  }

  return (
    <Button asChild size="sm" variant="ghost">
      <Link href={href}>View</Link>
    </Button>
  );
}

function TimelineItem({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${active ? 'bg-indigo-600' : 'bg-slate-300'}`}
      />
      <div>
        <p className="text-slate-500">{label}</p>
        <p className="font-medium text-slate-900">{value}</p>
      </div>
    </div>
  );
}

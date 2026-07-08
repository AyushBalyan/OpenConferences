'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/components/dashboard/data-table';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { WorkflowBadge } from '@/components/dashboard/workflow-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchMeDashboard } from '@/lib/api-client';
import { paperStatusLabel, paperStatusTone } from '@/lib/paper-status-styles';
import { roleLabels } from '@/lib/roles';
import type { MeDashboard } from '@openconferences/schemas';
import { useEffect, useState } from 'react';

export default function MeDashboardPage() {
  const [dashboard, setDashboard] = useState<MeDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMeDashboard()
      .then(setDashboard)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const isEmpty =
    dashboard &&
    dashboard.authoredPapers.length === 0 &&
    dashboard.reviewerAssignments.length === 0 &&
    dashboard.organizerConferences.length === 0;

  return (
    <>
      <PageHeader
        title="Your dashboard"
        description="Cross-conference view of submissions, reviews, and organizer workspaces."
      />

      {error ? <p className="mb-4 text-sm text-rose-600">{error}</p> : null}

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
          description="You will see your papers, review assignments, and organizer conferences here once you join a conference."
        />
      ) : null}

      {!loading && dashboard && dashboard.authoredPapers.length > 0 ? (
        <section className="mb-10 space-y-4">
          <SectionHeading title="My submissions" />
          <DataTable>
            <DataTableHeader>
              <tr>
                <DataTableHead>Title</DataTableHead>
                <DataTableHead>Conference</DataTableHead>
                <DataTableHead>Updated</DataTableHead>
                <DataTableHead>Status</DataTableHead>
                <DataTableHead className="text-right">Action</DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {dashboard.authoredPapers.map((paper) => (
                <DataTableRow key={paper.id}>
                  <DataTableCell>
                    <p className="font-medium text-slate-900">{paper.title}</p>
                  </DataTableCell>
                  <DataTableCell>{paper.conferenceName}</DataTableCell>
                  <DataTableCell className="font-mono text-xs">
                    {new Date(paper.updatedAt).toLocaleDateString()}
                  </DataTableCell>
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
          <SectionHeading title="Review assignments" />
          <DataTable>
            <DataTableHeader>
              <tr>
                <DataTableHead>Paper</DataTableHead>
                <DataTableHead>Conference</DataTableHead>
                <DataTableHead>Round</DataTableHead>
                <DataTableHead>Due</DataTableHead>
                <DataTableHead className="text-right">Action</DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {dashboard.reviewerAssignments.map((assignment) => (
                <DataTableRow key={assignment.id}>
                  <DataTableCell>
                    <p className="font-medium text-slate-900">{assignment.paperTitle}</p>
                  </DataTableCell>
                  <DataTableCell>{assignment.conferenceName}</DataTableCell>
                  <DataTableCell>Round {assignment.roundNumber}</DataTableCell>
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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dashboard.organizerConferences.map((conference) => {
              const labels = roleLabels(conference.myRoles);
              return (
                <Card key={conference.id} className="group transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-lg">{conference.name}</CardTitle>
                      <StatusBadge status={conference.status} />
                    </div>
                    <CardDescription>
                      {conference.slug}
                      {labels.length > 0 ? ` · ${labels.join(', ')}` : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="outline" className="group-hover:border-indigo-300">
                      <Link href={`/dashboard/conferences/${conference.id}`}>
                        Open workspace
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}
    </>
  );
}

function SectionHeading({ title }: { title: string }) {
  return <h2 className="text-lg font-medium text-slate-900">{title}</h2>;
}

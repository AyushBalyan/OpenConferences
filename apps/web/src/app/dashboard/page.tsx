'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchConferences } from '@/lib/api-client';
import { canCreateConference, roleLabels } from '@/lib/roles';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Conference } from '@/lib/conference-types';
import { ArrowRight } from 'lucide-react';

export default function DashboardPage() {
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConferences()
      .then((result) => setConferences(result.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const showCreateConference = useMemo(
    () => conferences.some((conference) => canCreateConference(conference.myRoles ?? [])),
    [conferences],
  );

  return (
    <>
      <PageHeader
        title="Your conferences"
        description="Pick a conference to open your author, reviewer, or organizer workspace."
        actions={
          showCreateConference ? (
            <Button asChild>
              <Link href="/dashboard/conferences/new">Create conference</Link>
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((key) => (
            <Card key={key}>
              <CardContent className="space-y-3 p-6">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-9 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {!loading && conferences.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {conferences.map((conference) => {
            const labels = roleLabels(conference.myRoles ?? []);
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
      ) : null}

      {!loading && conferences.length === 0 ? (
        <EmptyState
          title="No conferences yet"
          description={
            showCreateConference
              ? 'Create your first conference to get started with submissions and peer review.'
              : 'You will see conferences here once you are invited as an author, reviewer, or organizer.'
          }
          action={
            showCreateConference ? (
              <Button asChild>
                <Link href="/dashboard/conferences/new">Create conference</Link>
              </Button>
            ) : undefined
          }
        />
      ) : null}
    </>
  );
}

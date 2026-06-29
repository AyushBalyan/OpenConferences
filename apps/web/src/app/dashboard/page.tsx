'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { ConferenceSwitcher } from '@/components/dashboard/conference-switcher';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchConferences } from '@/lib/api-client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Conference } from '@/lib/conference-types';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConferences()
      .then((result) => setConferences(result.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Organizer dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Manage conferences, tracks, settings, and team roles.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/conferences/new">Create conference</Link>
        </Button>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading conferences…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!loading && conferences.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Conference switcher</CardTitle>
            <CardDescription>Jump into a conference workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <ConferenceSwitcher conferences={conferences} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {conferences.map((conference) => (
          <Card key={conference.id}>
            <CardHeader>
              <CardTitle>{conference.name}</CardTitle>
              <CardDescription>
                {conference.slug} · {conference.status}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href={`/dashboard/conferences/${conference.id}`}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && conferences.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No conferences yet</CardTitle>
            <CardDescription>Create your first conference to get started.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}

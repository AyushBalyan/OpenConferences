'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { ConferenceNav } from '@/components/dashboard/conference-nav';
import { ConferenceSwitcher } from '@/components/dashboard/conference-switcher';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchConference, fetchConferences, transitionConferenceStatus } from '@/lib/api-client';
import type { Conference } from '@/lib/conference-types';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function ConferenceOverviewPage() {
  return (
    <ProtectedRoute>
      <ConferenceOverview />
    </ProtectedRoute>
  );
}

function ConferenceOverview() {
  const params = useParams<{ id: string }>();
  const conferenceId = params.id;
  const [conference, setConference] = useState<Conference | null>(null);
  const [allConferences, setAllConferences] = useState<Conference[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [conf, list] = await Promise.all([fetchConference(conferenceId), fetchConferences()]);
      setConference(conf);
      setAllConferences(list.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [conferenceId]);

  useEffect(() => {
    load();
  }, [load]);

  async function openCfp() {
    setActionError(null);
    try {
      const updated = await transitionConferenceStatus(conferenceId, 'CFP_OPEN');
      setConference(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Transition failed');
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-destructive">{error}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/dashboard">Back</Link>
        </Button>
      </div>
    );
  }

  if (!conference) {
    return <div className="mx-auto max-w-5xl px-4 py-10 text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/dashboard" className="hover:underline">
              Dashboard
            </Link>{' '}
            / {conference.name}
          </p>
          <h1 className="text-2xl font-semibold">{conference.name}</h1>
        </div>
        <ConferenceSwitcher conferences={allConferences} currentId={conferenceId} />
      </div>

      <ConferenceNav conferenceId={conferenceId} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
            <CardDescription>Lifecycle state (display label)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-lg font-medium">{conference.status}</p>
            {conference.status === 'DRAFT' ? <Button onClick={openCfp}>Publish CFP</Button> : null}
            {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Blinding</CardTitle>
            <CardDescription>Review anonymity mode</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">{conference.blindingMode}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

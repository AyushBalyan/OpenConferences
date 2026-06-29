'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { ConferenceNav } from '@/components/dashboard/conference-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createTrack, fetchConference, fetchTracks } from '@/lib/api-client';
import type { Track } from '@/lib/conference-types';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function ConferenceTracksPage() {
  return (
    <ProtectedRoute>
      <TracksContent />
    </ProtectedRoute>
  );
}

function TracksContent() {
  const params = useParams<{ id: string }>();
  const conferenceId = params.id;
  const [conferenceName, setConferenceName] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [conference, trackList] = await Promise.all([
      fetchConference(conferenceId),
      fetchTracks(conferenceId),
    ]);
    setConferenceName(conference.name);
    setTracks(trackList);
  }, [conferenceId]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [load]);

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createTrack(conferenceId, { slug, name });
      setSlug('');
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create track');
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/dashboard/conferences/${conferenceId}`} className="hover:underline">
            {conferenceName || 'Conference'}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">Tracks</h1>
      </div>
      <ConferenceNav conferenceId={conferenceId} />

      <Card>
        <CardHeader>
          <CardTitle>Add track</CardTitle>
          <CardDescription>Define review sub-streams within the conference.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-3" onSubmit={onCreate}>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <Button type="submit" className="sm:col-span-3 w-fit">
              Create track
            </Button>
          </form>
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {tracks.map((track) => (
          <Card key={track.id}>
            <CardHeader>
              <CardTitle className="text-base">{track.name}</CardTitle>
              <CardDescription>{track.slug}</CardDescription>
            </CardHeader>
          </Card>
        ))}
        {tracks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tracks yet.</p>
        ) : null}
      </div>
    </div>
  );
}

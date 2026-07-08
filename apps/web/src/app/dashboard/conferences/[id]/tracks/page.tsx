'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFooter,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/components/dashboard/data-table';
import { createTrack, fetchTracks } from '@/lib/api-client';
import type { Track } from '@/lib/conference-types';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function ConferenceTracksPage() {
  return <TracksContent />;
}

function TracksContent() {
  const params = useParams<{ id: string }>();
  const conferenceId = params.id;
  const [tracks, setTracks] = useState<Track[]>([]);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const trackList = await fetchTracks(conferenceId);
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
    <div className="space-y-6">
      <PageHeader title="Tracks" description="Manage submission tracks for this conference." />

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
        {tracks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tracks yet.</p>
        ) : (
          <DataTable
            footer={
              <DataTableFooter>
                {tracks.length} track{tracks.length === 1 ? '' : 's'}
              </DataTableFooter>
            }
          >
            <DataTableHeader>
              <tr>
                <DataTableHead>Name</DataTableHead>
                <DataTableHead>Slug</DataTableHead>
                <DataTableHead>Description</DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {tracks.map((track) => (
                <DataTableRow key={track.id}>
                  <DataTableCell>
                    <p className="font-medium text-slate-900">{track.name}</p>
                  </DataTableCell>
                  <DataTableCell className="font-mono text-xs text-slate-500">
                    {track.slug}
                  </DataTableCell>
                  <DataTableCell className="text-slate-500">
                    {track.description ?? '—'}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </div>
    </div>
  );
}

'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmpty,
  DataTableFooter,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  DataTableSkeleton,
} from '@/components/dashboard/data-table';
import { SectionPageLayout } from '@/components/dashboard/section-page-layout';
import { createTrack, fetchTracks } from '@/lib/api-client';
import type { Track } from '@/lib/conference-types';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function ConferenceTracksPage() {
  const params = useParams<{ id: string }>();
  const conferenceId = params.id;
  const [tracks, setTracks] = useState<Track[]>([]);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const trackList = await fetchTracks(conferenceId);
    setTracks(trackList);
  }, [conferenceId]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
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
    <SectionPageLayout
      title="Tracks"
      description="Manage submission tracks for this conference."
      error={error}
    >
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
            <Button type="submit" className="w-fit sm:col-span-3">
              Create track
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-6 space-y-3">
        {loading ? (
          <DataTableSkeleton rows={4} />
        ) : tracks.length === 0 ? (
          <DataTableEmpty
            title="No tracks yet"
            description="Create a track to organize submissions."
          />
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
    </SectionPageLayout>
  );
}

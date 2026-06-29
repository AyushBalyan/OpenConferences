'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { ConferenceNav } from '@/components/dashboard/conference-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchConference, updateConferenceSettings } from '@/lib/api-client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function ConferenceSettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}

function SettingsContent() {
  const params = useParams<{ id: string }>();
  const conferenceId = params.id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    blindingMode: 'DOUBLE',
    cfpOpensAt: '',
    cfpClosesAt: '',
    reviewDueAt: '',
    decisionDueAt: '',
    currency: 'INR',
    regularEarly: '500000',
    regularRegular: '750000',
    studentEarly: '250000',
    studentRegular: '400000',
  });

  const load = useCallback(async () => {
    try {
      const conference = await fetchConference(conferenceId);
      setForm({
        blindingMode: conference.blindingMode,
        cfpOpensAt: conference.cfpOpensAt?.slice(0, 16) ?? '',
        cfpClosesAt: conference.cfpClosesAt?.slice(0, 16) ?? '',
        reviewDueAt: conference.reviewDueAt?.slice(0, 16) ?? '',
        decisionDueAt: conference.decisionDueAt?.slice(0, 16) ?? '',
        currency: conference.feeSchedule.currency,
        regularEarly: String(conference.feeSchedule.matrix.REGULAR?.EARLY ?? 0),
        regularRegular: String(conference.feeSchedule.matrix.REGULAR?.REGULAR ?? 0),
        studentEarly: String(conference.feeSchedule.matrix.STUDENT?.EARLY ?? 0),
        studentRegular: String(conference.feeSchedule.matrix.STUDENT?.REGULAR ?? 0),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [conferenceId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await updateConferenceSettings(conferenceId, {
        blindingMode: form.blindingMode as 'SINGLE' | 'DOUBLE' | 'OPEN',
        cfpOpensAt: form.cfpOpensAt ? new Date(form.cfpOpensAt).toISOString() : null,
        cfpClosesAt: form.cfpClosesAt ? new Date(form.cfpClosesAt).toISOString() : null,
        reviewDueAt: form.reviewDueAt ? new Date(form.reviewDueAt).toISOString() : null,
        decisionDueAt: form.decisionDueAt ? new Date(form.decisionDueAt).toISOString() : null,
        feeSchedule: {
          currency: form.currency,
          matrix: {
            REGULAR: {
              EARLY: Number(form.regularEarly),
              REGULAR: Number(form.regularRegular),
            },
            STUDENT: {
              EARLY: Number(form.studentEarly),
              REGULAR: Number(form.studentRegular),
            },
          },
        },
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-10 text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/dashboard/conferences/${conferenceId}`} className="hover:underline">
            Back to overview
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">Conference settings</h1>
      </div>
      <ConferenceNav conferenceId={conferenceId} />

      <Card>
        <CardHeader>
          <CardTitle>Phases, blinding & fees</CardTitle>
          <CardDescription>Configure phase windows and registration fee matrix.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={onSave}>
            <div className="space-y-2">
              <Label htmlFor="blindingMode">Blinding mode</Label>
              <select
                id="blindingMode"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.blindingMode}
                onChange={(e) => setForm({ ...form, blindingMode: e.target.value })}
              >
                <option value="SINGLE">Single blind</option>
                <option value="DOUBLE">Double blind</option>
                <option value="OPEN">Open</option>
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cfpOpensAt">CFP opens</Label>
                <Input
                  id="cfpOpensAt"
                  type="datetime-local"
                  value={form.cfpOpensAt}
                  onChange={(e) => setForm({ ...form, cfpOpensAt: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cfpClosesAt">CFP closes</Label>
                <Input
                  id="cfpClosesAt"
                  type="datetime-local"
                  value={form.cfpClosesAt}
                  onChange={(e) => setForm({ ...form, cfpClosesAt: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="regularEarly">Regular early (minor units)</Label>
                <Input
                  id="regularEarly"
                  value={form.regularEarly}
                  onChange={(e) => setForm({ ...form, regularEarly: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="regularRegular">Regular regular (minor units)</Label>
                <Input
                  id="regularRegular"
                  value={form.regularRegular}
                  onChange={(e) => setForm({ ...form, regularRegular: e.target.value })}
                />
              </div>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {saved ? <p className="text-sm text-green-600">Settings saved.</p> : null}
            <Button type="submit">Save settings</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFooter,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/components/dashboard/data-table';
import { WorkflowBadge } from '@/components/dashboard/workflow-badge';
import { COI_TYPE_OPTIONS } from '@/lib/review-types';
import { declareCoi, deleteCoi } from '@/lib/api-client';
import { useState } from 'react';
import { useCoiWorkspace } from './coi-workspace';

export function CoiDeclarePanel() {
  const { conferenceId, papers, busy, setBusy, setError, refresh } = useCoiWorkspace();
  const [paperId, setPaperId] = useState('');
  const [coiType, setCoiType] = useState<(typeof COI_TYPE_OPTIONS)[number]['value']>('OTHER');
  const [note, setNote] = useState('');

  async function handleDeclare() {
    if (!paperId) return;
    setBusy(true);
    setError(null);
    try {
      await declareCoi(conferenceId, { paperId, type: coiType, note: note || undefined });
      setNote('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to declare COI');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Declare conflict</CardTitle>
        <CardDescription>Report a conflict with a specific paper.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="coi-paper">Paper</Label>
            <select
              id="coi-paper"
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              value={paperId}
              onChange={(e) => setPaperId(e.target.value)}
            >
              <option value="">Select paper…</option>
              {papers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="coi-type">Type</Label>
            <select
              id="coi-type"
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              value={coiType}
              onChange={(e) =>
                setCoiType(e.target.value as (typeof COI_TYPE_OPTIONS)[number]['value'])
              }
            >
              {COI_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="coi-note">Note (optional)</Label>
          <Input id="coi-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <Button onClick={() => void handleDeclare()} disabled={busy || !paperId}>
          Declare conflict
        </Button>
      </CardContent>
    </Card>
  );
}

export function CoiListPanel({ title, description }: { title: string; description?: string }) {
  const { cois, busy, setBusy, setError, refresh, conferenceId, loading } = useCoiWorkspace();

  async function handleRemove(coiId: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteCoi(conferenceId, coiId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove COI');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-medium text-slate-900">{title}</h2>
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      </div>
      {cois.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">
            No conflicts declared.
          </CardContent>
        </Card>
      ) : (
        <DataTable
          footer={
            <DataTableFooter>
              {cois.length} conflict{cois.length === 1 ? '' : 's'}
            </DataTableFooter>
          }
        >
          <DataTableHeader>
            <tr>
              <DataTableHead>Paper</DataTableHead>
              <DataTableHead>Reviewer</DataTableHead>
              <DataTableHead>Type</DataTableHead>
              <DataTableHead>Source</DataTableHead>
              <DataTableHead>Note</DataTableHead>
              <DataTableHead className="text-right">Actions</DataTableHead>
            </tr>
          </DataTableHeader>
          <DataTableBody>
            {cois.map((coi) => (
              <DataTableRow key={coi.id}>
                <DataTableCell>
                  <p className="font-medium text-slate-900">
                    {coi.paperTitle ?? 'General conflict'}
                  </p>
                </DataTableCell>
                <DataTableCell>{coi.userName ?? '—'}</DataTableCell>
                <DataTableCell>
                  <WorkflowBadge label={coi.type.replace(/_/g, ' ')} tone="neutral" />
                </DataTableCell>
                <DataTableCell className="text-slate-500">{coi.source}</DataTableCell>
                <DataTableCell>
                  {coi.note ? (
                    <p className="line-clamp-2 text-sm text-slate-500">{coi.note}</p>
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </DataTableCell>
                <DataTableCell className="text-right">
                  {coi.source !== 'SYSTEM' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void handleRemove(coi.id)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}
    </div>
  );
}

export function CoiAlerts() {
  const { error } = useCoiWorkspace();
  return error ? <p className="mb-4 text-sm text-rose-600">{error}</p> : null;
}

'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent } from '@/components/ui/card';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFooter,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/components/dashboard/data-table';
import { CursorLoadMore } from '@/components/dashboard/cursor-load-more';
import { fetchAuditLogs } from '@/lib/api-client';
import type { AuditEntry } from '@/lib/conference-types';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function ConferenceAuditPage() {
  return <AuditContent />;
}

function AuditContent() {
  const params = useParams<{ id: string }>();
  const conferenceId = params.id;
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (cursor?: string, append = false) => {
      const result = await fetchAuditLogs(conferenceId, cursor ? { cursor } : { limit: 50 });
      setLogs((prev) => (append ? [...prev, ...result.data] : result.data));
      setNextCursor(result.nextCursor);
      setError(null);
    },
    [conferenceId],
  );

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [load]);

  async function handleLoadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      await load(nextCursor, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Audit log" description="Recent actions recorded for this conference." />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {logs.length === 0 && !error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">
            No audit entries yet.
          </CardContent>
        </Card>
      ) : (
        <>
          <DataTable
            footer={
              <DataTableFooter>
                Showing {logs.length} entr{logs.length === 1 ? 'y' : 'ies'}
              </DataTableFooter>
            }
          >
            <DataTableHeader>
              <tr>
                <DataTableHead>Action</DataTableHead>
                <DataTableHead>Entity</DataTableHead>
                <DataTableHead>Entity ID</DataTableHead>
                <DataTableHead>Timestamp</DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {logs.map((log) => (
                <DataTableRow key={log.id}>
                  <DataTableCell>
                    <p className="font-medium text-slate-900">{log.action.replace(/_/g, ' ')}</p>
                  </DataTableCell>
                  <DataTableCell>{log.entity}</DataTableCell>
                  <DataTableCell className="font-mono text-xs text-slate-500">
                    {log.entityId ?? '—'}
                  </DataTableCell>
                  <DataTableCell className="font-mono text-xs text-slate-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
          <CursorLoadMore
            nextCursor={nextCursor}
            onLoadMore={handleLoadMore}
            loading={loadingMore}
          />
        </>
      )}
    </div>
  );
}

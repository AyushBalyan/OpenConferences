'use client';

import { useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmpty,
  DataTableFooter,
  DataTableHead,
  DataTableHeader,
  DataTablePagination,
  DataTableRow,
  DataTableSkeleton,
} from '@/components/dashboard/data-table';
import { SectionPageLayout } from '@/components/dashboard/section-page-layout';
import { fetchAuditLogs } from '@/lib/api-client';
import type { AuditEntry } from '@/lib/conference-types';
import { useCursorList } from '@/hooks/dashboard/use-cursor-list';

export default function ConferenceAuditPage() {
  const params = useParams<{ id: string }>();
  const conferenceId = params.id;

  const fetchPage = useCallback(
    async (cursor?: string) => {
      const result = await fetchAuditLogs(conferenceId, cursor ? { cursor } : { limit: 50 });
      return { data: result.data, nextCursor: result.nextCursor };
    },
    [conferenceId],
  );

  const { items, nextCursor, loading, loadingMore, error, loadMore, refresh } =
    useCursorList<AuditEntry>({ fetchPage });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <SectionPageLayout
      title="Audit log"
      description="Recent actions recorded for this conference."
      error={error}
    >
      {loading ? (
        <DataTableSkeleton rows={6} />
      ) : items.length === 0 ? (
        <DataTableEmpty title="No audit entries yet" />
      ) : (
        <>
          <DataTable
            footer={
              <DataTableFooter>
                Showing {items.length} entr{items.length === 1 ? 'y' : 'ies'}
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
              {items.map((log) => (
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
          <DataTablePagination
            nextCursor={nextCursor}
            onLoadMore={loadMore}
            loading={loadingMore}
          />
        </>
      )}
    </SectionPageLayout>
  );
}

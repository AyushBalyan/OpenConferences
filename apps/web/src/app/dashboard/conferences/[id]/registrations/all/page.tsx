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
import { WorkflowBadge } from '@/components/dashboard/workflow-badge';
import { fetchRegistrations } from '@/lib/api-client';
import { useCursorList } from '@/hooks/dashboard/use-cursor-list';

function formatMoney(minor: number, currency: string): string {
  return `${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currency}`;
}

function registrationTone(status: string) {
  if (status === 'PAID' || status === 'COMPLETED') return 'success' as const;
  if (status === 'PENDING' || status === 'AWAITING_PAYMENT') return 'pending' as const;
  if (status === 'CANCELLED' || status === 'REFUNDED') return 'danger' as const;
  return 'neutral' as const;
}

type RegistrationRow = {
  id: string;
  paperTitle?: string;
  status: string;
  audience: string;
  amountDueMinor: number;
  currency: string;
  deadlineAt: string;
};

export default function RegistrationsAllPage() {
  const params = useParams<{ id: string }>();
  const conferenceId = params.id;

  const fetchPage = useCallback(
    async (cursor?: string) => {
      const result = await fetchRegistrations(conferenceId, cursor ? { cursor } : { limit: 50 });
      return { data: result.data as RegistrationRow[], nextCursor: result.nextCursor };
    },
    [conferenceId],
  );

  const { items, nextCursor, loading, loadingMore, error, loadMore, refresh } =
    useCursorList<RegistrationRow>({ fetchPage });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <SectionPageLayout
      title="All registrations"
      description="Registration status and payment details for accepted papers."
      error={error}
    >
      {loading ? (
        <DataTableSkeleton rows={6} />
      ) : items.length === 0 ? (
        <DataTableEmpty title="No registrations yet" />
      ) : (
        <>
          <DataTable
            footer={
              <DataTableFooter>
                {items.length} registration{items.length === 1 ? '' : 's'}
              </DataTableFooter>
            }
          >
            <DataTableHeader>
              <tr>
                <DataTableHead>Paper</DataTableHead>
                <DataTableHead>Audience</DataTableHead>
                <DataTableHead>Status</DataTableHead>
                <DataTableHead>Amount due</DataTableHead>
                <DataTableHead>Deadline</DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {items.map((row) => (
                <DataTableRow key={row.id}>
                  <DataTableCell>
                    <p className="font-medium text-slate-900">{row.paperTitle ?? row.id}</p>
                  </DataTableCell>
                  <DataTableCell>{row.audience}</DataTableCell>
                  <DataTableCell>
                    <WorkflowBadge
                      label={row.status.replace(/_/g, ' ').toLowerCase()}
                      tone={registrationTone(row.status)}
                    />
                  </DataTableCell>
                  <DataTableCell className="font-mono text-xs">
                    {formatMoney(row.amountDueMinor, row.currency)}
                  </DataTableCell>
                  <DataTableCell className="font-mono text-xs text-slate-500">
                    {new Date(row.deadlineAt).toLocaleDateString()}
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

'use client';

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
import { WorkflowBadge } from '@/components/dashboard/workflow-badge';
import { fetchRegistrations } from '@/lib/api-client';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

function formatMoney(minor: number, currency: string): string {
  return `${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currency}`;
}

function registrationTone(status: string) {
  if (status === 'PAID' || status === 'COMPLETED') return 'success' as const;
  if (status === 'PENDING' || status === 'AWAITING_PAYMENT') return 'pending' as const;
  if (status === 'CANCELLED' || status === 'REFUNDED') return 'danger' as const;
  return 'neutral' as const;
}

export default function RegistrationsAllPage() {
  const params = useParams<{ id: string }>();
  const conferenceId = params.id;
  const [rows, setRows] = useState<
    Array<{
      id: string;
      paperTitle?: string;
      status: string;
      audience: string;
      amountDueMinor: number;
      currency: string;
      deadlineAt: string;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchRegistrations(conferenceId);
      setRows(data.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [conferenceId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      {error ? <p className="mb-4 text-sm text-rose-600">{error}</p> : null}
      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">
            No registrations yet.
          </CardContent>
        </Card>
      ) : (
        <DataTable
          footer={
            <DataTableFooter>
              {rows.length} registration{rows.length === 1 ? '' : 's'}
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
            {rows.map((row) => (
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
      )}
    </>
  );
}

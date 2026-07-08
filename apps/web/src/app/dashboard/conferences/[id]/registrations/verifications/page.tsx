'use client';

import { Button } from '@/components/ui/button';
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
import { fetchStudentVerifications, reviewStudentVerification } from '@/lib/api-client';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function RegistrationsVerificationsPage() {
  const params = useParams<{ id: string }>();
  const conferenceId = params.id;
  const [rows, setRows] = useState<
    Array<{
      id: string;
      paperTitle?: string;
      status: string;
      note: string | null;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchStudentVerifications(conferenceId);
      setRows(data.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [conferenceId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(
    verificationId: string,
    action: 'APPROVE' | 'CLARIFY' | 'REJECT',
    note?: string,
  ) {
    setBusyId(verificationId);
    setError(null);
    try {
      await reviewStudentVerification(conferenceId, verificationId, { action, note });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {error ? <p className="mb-4 text-sm text-rose-600">{error}</p> : null}
      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">
            No pending verifications.
          </CardContent>
        </Card>
      ) : (
        <DataTable
          footer={
            <DataTableFooter>
              {rows.length} verification{rows.length === 1 ? '' : 's'} pending
            </DataTableFooter>
          }
        >
          <DataTableHeader>
            <tr>
              <DataTableHead>Paper</DataTableHead>
              <DataTableHead>Status</DataTableHead>
              <DataTableHead className="text-right">Actions</DataTableHead>
            </tr>
          </DataTableHeader>
          <DataTableBody>
            {rows.map((row) => (
              <DataTableRow key={row.id}>
                <DataTableCell>
                  <p className="font-medium text-slate-900">{row.paperTitle ?? row.id}</p>
                </DataTableCell>
                <DataTableCell>
                  <WorkflowBadge
                    label={row.status.replace(/_/g, ' ').toLowerCase()}
                    tone="pending"
                  />
                </DataTableCell>
                <DataTableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button
                      size="sm"
                      disabled={busyId === row.id}
                      onClick={() => void act(row.id, 'APPROVE')}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === row.id}
                      onClick={() =>
                        void act(row.id, 'CLARIFY', 'Please upload a clearer student ID document.')
                      }
                    >
                      Clarify
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-rose-600 hover:text-rose-700"
                      disabled={busyId === row.id}
                      onClick={() =>
                        void act(row.id, 'REJECT', 'Document does not qualify for student rate.')
                      }
                    >
                      Reject
                    </Button>
                  </div>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}
    </>
  );
}

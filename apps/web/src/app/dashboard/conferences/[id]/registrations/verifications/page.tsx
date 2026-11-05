'use client';

import { SubmissionDate } from '@/components/dashboard/submission-date';

import { Textarea } from '@/components/ui/textarea';
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
import {
  fetchStudentVerifications,
  reviewStudentVerification,
  downloadStudentVerification,
} from '@/lib/api-client';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function RegistrationsVerificationsPage() {
  const params = useParams<{ id: string }>();
  const conferenceId = params.id;
  const [rows, setRows] = useState<
    Array<{
      id: string;
      paperTitle?: string;
      paperSubmittedAt?: string | null;
      status: string;
      note: string | null;
      scanStatus?: string;
      originalFilename?: string;
    }>
  >([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
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

  useEffect(() => {
    if (!rows.some((row) => row.scanStatus === 'PENDING_SCAN')) return;
    const timer = window.setInterval(() => {
      void load();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [rows, load]);

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
            No student verifications.
          </CardContent>
        </Card>
      ) : (
        <DataTable
          footer={
            <DataTableFooter>
              {rows.length} verification{rows.length === 1 ? '' : 's'}
            </DataTableFooter>
          }
        >
          <DataTableHeader>
            <tr>
              <DataTableHead>Paper</DataTableHead>
              <DataTableHead>Submission date</DataTableHead>
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
                  <SubmissionDate value={row.paperSubmittedAt} />
                </DataTableCell>
                <DataTableCell>
                  <WorkflowBadge
                    label={row.status.replace(/_/g, ' ').toLowerCase()}
                    tone={
                      row.status === 'APPROVED'
                        ? 'success'
                        : row.status === 'REJECTED'
                          ? 'danger'
                          : 'pending'
                    }
                  />
                  <p className="mt-1 text-xs text-slate-600">
                    {row.scanStatus === 'CLEAN'
                      ? row.originalFilename
                      : row.scanStatus === 'INFECTED'
                        ? 'Unsafe document — request a replacement'
                        : 'File check pending'}
                  </p>
                </DataTableCell>
                <DataTableCell className="text-right">
                  {['PENDING', 'CLARIFICATION_REQUESTED'].includes(row.status) ? (
                    <Textarea
                      className="mb-2 min-w-48"
                      aria-label={`Review note for ${row.paperTitle ?? row.id}`}
                      placeholder="Reason or clarification for the author"
                      value={notes[row.id] ?? ''}
                      onChange={(event) =>
                        setNotes((current) => ({ ...current, [row.id]: event.target.value }))
                      }
                      maxLength={2000}
                    />
                  ) : null}
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === row.id || row.scanStatus !== 'CLEAN'}
                      onClick={async () => {
                        setBusyId(row.id);
                        setError(null);
                        try {
                          window.location.assign(
                            await downloadStudentVerification(conferenceId, row.id),
                          );
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Download failed');
                        } finally {
                          setBusyId(null);
                        }
                      }}
                    >
                      Download document
                    </Button>
                    <Button
                      size="sm"
                      disabled={
                        busyId === row.id ||
                        row.scanStatus !== 'CLEAN' ||
                        !['PENDING', 'CLARIFICATION_REQUESTED'].includes(row.status)
                      }
                      onClick={() => void act(row.id, 'APPROVE', notes[row.id] || undefined)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        busyId === row.id ||
                        !['PENDING', 'CLARIFICATION_REQUESTED'].includes(row.status)
                      }
                      onClick={() =>
                        void act(
                          row.id,
                          'CLARIFY',
                          notes[row.id]?.trim() || 'Please upload a clearer student ID document.',
                        )
                      }
                    >
                      Clarify
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-rose-600 hover:text-rose-700"
                      disabled={
                        busyId === row.id ||
                        !['PENDING', 'CLARIFICATION_REQUESTED'].includes(row.status)
                      }
                      onClick={() =>
                        void act(
                          row.id,
                          'REJECT',
                          notes[row.id]?.trim() || 'Document does not qualify for student rate.',
                        )
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

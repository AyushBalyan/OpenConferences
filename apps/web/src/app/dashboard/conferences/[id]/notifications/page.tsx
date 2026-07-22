'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DataTableToolbar,
} from '@/components/dashboard/data-table';
import { SectionPageLayout } from '@/components/dashboard/section-page-layout';
import { fetchNotificationLogs, resendNotification } from '@/lib/api-client';
import type { NotificationLogEntry } from '@/lib/conference-types';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const statusVariant: Record<
  NotificationLogEntry['status'],
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  QUEUED: 'secondary',
  SENT: 'default',
  FAILED: 'destructive',
  BOUNCED: 'destructive',
};

export default function ConferenceNotificationsPage() {
  const params = useParams<{ id: string }>();
  const conferenceId = params.id;
  const [logs, setLogs] = useState<NotificationLogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await fetchNotificationLogs(conferenceId, {
      search: search.trim() || undefined,
    });
    setLogs(result.data);
  }, [conferenceId, search]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [load]);

  async function handleResend(logId: string) {
    setResendingId(logId);
    setError(null);
    try {
      await resendNotification(conferenceId, logId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resend failed');
    } finally {
      setResendingId(null);
    }
  }

  return (
    <SectionPageLayout
      title="Email log"
      description="Delivery status for transactional emails sent from this conference."
      error={error}
      actions={
        <Button variant="outline" asChild>
          <Link href={`/dashboard/conferences/${conferenceId}/notifications/templates`}>
            Manage templates
          </Link>
        </Button>
      }
    >
      <DataTableToolbar>
        <Input
          className="max-w-md"
          placeholder="Search by recipient or subject…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </DataTableToolbar>

      {loading ? (
        <DataTableSkeleton rows={6} />
      ) : logs.length === 0 ? (
        <DataTableEmpty title="No emails logged yet" />
      ) : (
        <DataTable
          footer={
            <DataTableFooter>
              {logs.length} email{logs.length === 1 ? '' : 's'}
            </DataTableFooter>
          }
        >
          <DataTableHeader>
            <tr>
              <DataTableHead>Subject</DataTableHead>
              <DataTableHead>Recipient</DataTableHead>
              <DataTableHead>Template</DataTableHead>
              <DataTableHead>Status</DataTableHead>
              <DataTableHead>Sent</DataTableHead>
              <DataTableHead className="text-right">Actions</DataTableHead>
            </tr>
          </DataTableHeader>
          <DataTableBody>
            {logs.map((log) => (
              <DataTableRow key={log.id}>
                <DataTableCell>
                  <div>
                    <p className="font-medium text-slate-900">{log.subject}</p>
                    {log.error ? <p className="mt-0.5 text-xs text-rose-600">{log.error}</p> : null}
                  </div>
                </DataTableCell>
                <DataTableCell>{log.toEmail}</DataTableCell>
                <DataTableCell className="font-mono text-xs text-slate-500">
                  {log.templateKey}
                </DataTableCell>
                <DataTableCell>
                  <Badge variant={statusVariant[log.status]}>{log.status}</Badge>
                </DataTableCell>
                <DataTableCell className="font-mono text-xs text-slate-500">
                  {new Date(log.createdAt).toLocaleString()}
                </DataTableCell>
                <DataTableCell className="text-right">
                  {log.status !== 'QUEUED' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={resendingId === log.id}
                      onClick={() => void handleResend(log.id)}
                    >
                      Resend
                    </Button>
                  ) : null}
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}
    </SectionPageLayout>
  );
}

'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  return <NotificationsContent />;
}

function NotificationsContent() {
  const params = useParams<{ id: string }>();
  const conferenceId = params.id;
  const [logs, setLogs] = useState<NotificationLogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await fetchNotificationLogs(conferenceId, {
      search: search.trim() || undefined,
    });
    setLogs(result.data);
  }, [conferenceId, search]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
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
    <div className="space-y-6">
      <PageHeader
        title="Email log"
        description="Delivery status for transactional emails sent from this conference."
        actions={
          <Button variant="outline" asChild>
            <Link href={`/dashboard/conferences/${conferenceId}/notifications/templates`}>
              Manage templates
            </Link>
          </Button>
        }
      />

      <Input
        placeholder="Search by recipient or subject…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="space-y-3">
        {logs.map((log) => (
          <Card key={log.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-base">{log.subject}</CardTitle>
                <CardDescription>
                  {log.toEmail} · {log.templateKey} · {new Date(log.createdAt).toLocaleString()}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant[log.status]}>{log.status}</Badge>
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
              </div>
            </CardHeader>
            {log.error ? <p className="px-6 pb-4 text-sm text-destructive">{log.error}</p> : null}
          </Card>
        ))}
        {logs.length === 0 && !error ? (
          <p className="text-sm text-muted-foreground">No emails logged yet.</p>
        ) : null}
      </div>
    </div>
  );
}

'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await fetchAuditLogs(conferenceId);
    setLogs(data);
  }, [conferenceId]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader title="Audit log" description="Recent actions recorded for this conference." />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="space-y-3">
        {logs.map((log) => (
          <Card key={log.id}>
            <CardHeader>
              <CardTitle className="text-base">{log.action}</CardTitle>
              <CardDescription>
                {log.entity}
                {log.entityId ? ` · ${log.entityId}` : ''} ·{' '}
                {new Date(log.createdAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
        {logs.length === 0 && !error ? (
          <p className="text-sm text-muted-foreground">No audit entries yet.</p>
        ) : null}
      </div>
    </div>
  );
}

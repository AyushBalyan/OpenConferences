'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchRegistrations } from '@/lib/api-client';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

function formatMoney(minor: number, currency: string): string {
  return `${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currency}`;
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
      <Card>
        <CardHeader>
          <CardTitle>All registrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-slate-500">No registrations yet.</p>
          ) : (
            rows.map((row) => (
              <div key={row.id} className="border-b border-slate-100 pb-3 text-sm last:border-0">
                <p className="font-medium text-slate-900">{row.paperTitle ?? row.id}</p>
                <p className="text-slate-500">
                  {row.audience} · {row.status.replace(/_/g, ' ').toLowerCase()} · due{' '}
                  {formatMoney(row.amountDueMinor, row.currency)} · deadline{' '}
                  {new Date(row.deadlineAt).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}

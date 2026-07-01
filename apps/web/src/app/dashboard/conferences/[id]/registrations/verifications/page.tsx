'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      <Card>
        <CardHeader>
          <CardTitle>Student verification queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.length === 0 ? (
            <p className="text-sm text-slate-500">No pending verifications.</p>
          ) : (
            rows.map((row) => (
              <div key={row.id} className="space-y-2 border-b border-slate-100 pb-4 last:border-0">
                <p className="text-sm font-medium text-slate-900">{row.paperTitle ?? row.id}</p>
                <div className="flex flex-wrap gap-2">
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
                    Request clarification
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
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}

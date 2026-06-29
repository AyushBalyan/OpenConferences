import { fetchHealthz } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function HomePage() {
  let health: { status: string; timestamp: string; version?: string } | null = null;
  let error: string | null = null;

  try {
    health = await fetchHealthz();
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to reach API';
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <header className="mb-12">
          <p className="text-sm font-medium uppercase tracking-wider text-primary">Phase 0</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">OpenConferences</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Project foundation — monorepo skeleton with typed contracts end to end.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>API Health</CardTitle>
          </CardHeader>
          <CardContent>
            {health ? (
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="font-medium text-green-600">{health.status}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Timestamp</dt>
                  <dd className="font-mono text-xs">{health.timestamp}</dd>
                </div>
                {health.version && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Version</dt>
                    <dd>{health.version}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-destructive">{error ?? 'API unreachable'}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

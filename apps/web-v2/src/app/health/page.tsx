import type { Metadata } from 'next';
import { apiBaseUrl } from '@/lib/api';
import { getApiHealth } from '@/lib/health';

export const metadata: Metadata = { title: 'Health · OpenConferences redesign' };

// Checked on every request, never cached or prerendered.
export const dynamic = 'force-dynamic';

const STATUS_LABEL = { ok: 'Working', degraded: 'Degraded', error: 'Not working' } as const;

const CHECK_NAME: Record<string, string> = { postgres: 'Database', redis: 'Redis' };

export default async function HealthPage() {
  const api = await getApiHealth();

  return (
    <main>
      <h1>Health</h1>
      <p>The state of the redesign running on this machine.</p>

      <h2>Services</h2>
      <ul className="checks">
        <li>
          <span>Web app (apps/web-v2)</span>
          <span className="status">{STATUS_LABEL.ok}</span>
        </li>
        <li>
          <span>API</span>
          <span className="status">{api.reachable ? STATUS_LABEL.ok : STATUS_LABEL.error}</span>
          <span className="detail">
            {api.reachable ? (
              <>
                Answering at <code>{apiBaseUrl}</code>
                {api.liveness.version ? `, version ${api.liveness.version}` : ''}.
              </>
            ) : (
              <>
                {api.reason} Checked <code>{apiBaseUrl}</code>. Start everything with{' '}
                <code>pnpm redesign:dev</code>.
              </>
            )}
          </span>
        </li>
        {api.reachable &&
          api.readiness.checks.map((check) => (
            <li key={check.name}>
              <span>{CHECK_NAME[check.name] ?? check.name}</span>
              <span className="status">{STATUS_LABEL[check.status]}</span>
              {check.message ? <span className="detail">{check.message}</span> : null}
            </li>
          ))}
      </ul>
    </main>
  );
}

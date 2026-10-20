'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { KeyRound, RefreshCw } from 'lucide-react';
import {
  INTEGRATION_SCOPES,
  SCOPE_DEPENDENCIES,
  type IntegrationScope,
  type ApiIntegrationDto,
} from '@openconferences/schemas';
import { integrationsClient as client } from '@/lib/integrations-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConferenceWorkspace } from '@/components/dashboard/conference-workspace';
import { canCoordinateReview } from '@/lib/roles';

const scopeNames: Record<IntegrationScope, string> = {
  'papers:read': 'Paper metadata',
  'authors:read': 'Author names & affiliations',
  'authors:contacts:read': 'Author email addresses',
  'reviewers:read': 'Reviewer workload (aliases)',
  'reviewers:identity:read': 'Reviewer names',
  'reviewers:contacts:read': 'Reviewer email addresses',
  'assignments:read': 'Assignments & deadlines',
  'assignments:write': 'Assign papers with a deadline',
  'analytics:read': 'Conference summary',
};
function dependencies(scopes: IntegrationScope[]): IntegrationScope[] {
  const all = new Set(scopes);
  for (const scope of all) for (const dep of SCOPE_DEPENDENCIES[scope] ?? []) all.add(dep);
  return INTEGRATION_SCOPES.filter((s) => all.has(s));
}
function ScopePicker({
  value,
  onChange,
  allowed = INTEGRATION_SCOPES,
}: {
  value: IntegrationScope[];
  onChange: (s: IntegrationScope[]) => void;
  allowed?: readonly IntegrationScope[];
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-3 text-sm font-medium text-slate-800">Allowed access</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {allowed.map((scope) => (
          <label
            key={scope}
            className="flex cursor-pointer items-start gap-3 text-sm text-slate-700"
          >
            <input
              className="mt-0.5 h-4 w-4 accent-indigo-600"
              type="checkbox"
              checked={value.includes(scope)}
              onChange={(e) => {
                if (e.target.checked) onChange(dependencies([...value, scope]));
                else {
                  let next = value.filter((s) => s !== scope);
                  let prev;
                  do {
                    prev = next.length;
                    next = next.filter((s) =>
                      (SCOPE_DEPENDENCIES[s] ?? []).every((d) => next.includes(d)),
                    );
                  } while (next.length !== prev);
                  onChange(next);
                }
              }}
            />
            {scopeNames[scope]}
          </label>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Related permissions are selected together. Names and emails require explicit access. “Assign
        papers with a deadline” permits writes and emails reviewers with that deadline.
      </p>
    </fieldset>
  );
}
type AccessRow = {
  id: string;
  requestId: string;
  route: string;
  method: string;
  status: number;
  resultCount: number;
  durationMs: number;
  observedAt: string;
};
function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('en', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      }).format(new Date(value)) + ' UTC'
    : 'Never';
}
function failure(result: { body: unknown }) {
  return new Error(
    result.body && typeof result.body === 'object' && 'detail' in result.body
      ? String(result.body.detail)
      : 'Could not complete this action. Refresh and try again.',
  );
}

export default function IntegrationsPage() {
  const { id: conferenceId } = useParams<{ id: string }>();
  const { conference } = useConferenceWorkspace();
  const roles = conference?.myRoles ?? [];
  const [items, setItems] = useState<ApiIntegrationDto[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [selected, setSelected] = useState<ApiIntegrationDto | null>(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false),
    [editing, setEditing] = useState(false),
    [name, setName] = useState(''),
    [purpose, setPurpose] = useState(''),
    [scopes, setScopes] = useState<IntegrationScope[]>(['papers:read']);
  const [issuing, setIssuing] = useState(false),
    [label, setLabel] = useState('Bot key'),
    [days, setDays] = useState(30),
    [keyScopes, setKeyScopes] = useState<IntegrationScope[]>([]),
    [secret, setSecret] = useState<string | null>(null),
    [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<{
    kind: 'revoke' | 'reauthorize' | 'revokeKey';
    keyId?: string;
  } | null>(null);
  const [logs, setLogs] = useState<AccessRow[] | null>(null),
    [logCursor, setLogCursor] = useState<string | null>(null);
  const secretRef = useRef<HTMLTextAreaElement>(null);
  const permitted = canCoordinateReview(roles);
  const [testAccess, setTestAccess] = useState('');
  const load = useCallback(
    async (after?: string) => {
      setError(null);
      const r = await client.list({
        params: { conferenceId },
        query: { limit: 25, ...(after ? { cursor: after } : {}) },
      });
      if (r.status !== 200) throw failure(r);
      setItems((prev) => (after ? [...prev, ...r.body.data] : r.body.data));
      setCursor(r.body.nextCursor);
      setSelected((prev) => (prev ? (r.body.data.find((g) => g.id === prev.id) ?? prev) : null));
    },
    [conferenceId],
  );
  useEffect(() => {
    if (!permitted) {
      setLoading(false);
      return;
    }
    setLoading(true);
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [load, permitted]);
  // Secrets live only in component memory and are discarded when leaving this page.
  useEffect(() => {
    if (secret) {
      secretRef.current?.focus();
      secretRef.current?.select();
    }
  }, [secret]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }
  function choose(item: ApiIntegrationDto) {
    setSelected(item);
    setEditing(false);
    setIssuing(false);
    setSecret(null);
    setConfirm(null);
    setLogs(null);
    setNotice('');
    setError(null);
  }
  function update(item: ApiIntegrationDto) {
    setSelected(item);
    setItems((prev) => prev.map((g) => (g.id === item.id ? item : g)));
  }
  async function save() {
    if (!name.trim() || !scopes.length) return;
    const r =
      editing && selected
        ? await client.update({
            params: { conferenceId, integrationId: selected.id },
            body: { version: selected.version, name, purpose, scopes },
          })
        : await client.create({ params: { conferenceId }, body: { name, purpose, scopes } });
    if (r.status !== 200 && r.status !== 201) throw failure(r);
    const item = r.body as ApiIntegrationDto;
    setCreating(false);
    setEditing(false);
    setSelected(item);
    await load();
    setNotice(
      editing
        ? 'Access updated. Existing keys cannot gain new permissions.'
        : 'Integration created. Issue a key to connect your bot.',
    );
  }
  async function toggle() {
    if (!selected) return;
    const r = await client.update({
      params: { conferenceId, integrationId: selected.id },
      body: {
        version: selected.version,
        status: selected.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
      },
    });
    if (r.status !== 200) throw failure(r);
    update(r.body);
    setNotice(r.body.status === 'SUSPENDED' ? 'Bot access suspended.' : 'Bot access resumed.');
  }
  async function issue() {
    if (!selected) return;
    const r = await client.issueKey({
      params: { conferenceId, integrationId: selected.id },
      body: { label, scopes: keyScopes, expiresInDays: days, requestId: crypto.randomUUID() },
    });
    if (r.status !== 201) throw failure(r);
    setSecret(r.body.token);
    setCopied(false);
    setTestAccess('');
    setIssuing(false);
    const detail = await client.get({ params: { conferenceId, integrationId: selected.id } });
    if (detail.status === 200) update(detail.body);
  }
  async function confirmed() {
    if (!selected || !confirm) return;
    const params = { conferenceId, integrationId: selected.id };
    const r =
      confirm.kind === 'revokeKey'
        ? await client.revokeKey({ params: { ...params, keyId: confirm.keyId! }, body: {} })
        : confirm.kind === 'reauthorize'
          ? await client.reauthorize({ params, body: { version: selected.version } })
          : await client.revoke({ params, body: { version: selected.version } });
    if (r.status !== 200) throw failure(r);
    update(r.body);
    setConfirm(null);
    setSecret(null);
    setNotice('Access updated.');
  }
  async function access(after?: string) {
    if (!selected) return;
    const r = await client.access({
      params: { conferenceId, integrationId: selected.id },
      query: { limit: 25, ...(after ? { cursor: after } : {}) },
    });
    if (r.status !== 200) throw failure(r);
    setLogs((prev) => (after ? [...(prev ?? []), ...r.body.data] : r.body.data));
    setLogCursor(r.body.nextCursor);
  }
  if (!permitted)
    return (
      <p className="text-sm text-slate-600">Only organizers and chairs can manage bot access.</p>
    );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Integrations</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Choose what a bot can read or assign in this conference, then issue an expiring key.
            Paper assignment requires a separate permission.
          </p>
        </div>
        <Button
          disabled={busy || loading}
          onClick={() => {
            setCreating(true);
            setEditing(false);
            setName('');
            setPurpose('');
            setScopes(['papers:read']);
            setSecret(null);
          }}
        >
          New integration
        </Button>
      </div>
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() =>
              action(async () => {
                await load();
                if (selected) {
                  const result = await client.get({
                    params: { conferenceId, integrationId: selected.id },
                  });
                  if (result.status !== 200) throw failure(result);
                  update(result.body);
                }
              })
            }
          >
            Refresh
          </Button>
        </div>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      {(creating || editing) && (
        <form
          aria-label={editing ? 'Edit integration' : 'New integration'}
          className="space-y-5 rounded-lg border border-slate-200 bg-white p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void action(save);
          }}
        >
          <h3 className="font-semibold">{editing ? 'Edit access' : 'New integration'}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              Integration name
              <Input
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Conference assistant"
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Purpose <span className="font-normal text-slate-500">(optional)</span>
              <Input
                maxLength={500}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Daily review progress reports"
              />
            </label>
          </div>
          <ScopePicker value={scopes} onChange={setScopes} />
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !scopes.length}>
              {busy ? 'Saving…' : editing ? 'Save access' : 'Create integration'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      {loading ? (
        <p role="status" className="py-8 text-sm text-slate-500">
          Loading integrations…
        </p>
      ) : !items.length && !error ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-8">
          <KeyRound className="mb-3 h-6 w-6 text-indigo-600" />
          <h3 className="font-medium text-slate-900">No bots connected</h3>
          <p className="mt-1 text-sm text-slate-600">
            Create an integration to share paper metadata, assignments, or review progress.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <ul className="divide-y divide-slate-100">
            {items.map((g) => (
              <li key={g.id}>
                <button
                  onClick={() => choose(g)}
                  aria-pressed={selected?.id === g.id}
                  className={`flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left focus-visible:outline-indigo-600 ${selected?.id === g.id ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                >
                  <span className="min-w-0">
                    <span className="block break-words font-medium text-slate-900">{g.name}</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {g.scopes.length} permissions ·{' '}
                      {
                        g.keys.filter((k) => !k.revokedAt && new Date(k.expiresAt) > new Date())
                          .length
                      }{' '}
                      active keys
                    </span>
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${g.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}
                  >
                    {g.status === 'ACTIVE'
                      ? 'Active'
                      : g.status === 'SUSPENDED'
                        ? 'Suspended'
                        : 'Revoked'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {cursor && (
            <Button
              variant="ghost"
              className="m-3"
              disabled={busy}
              onClick={() => action(() => load(cursor))}
            >
              Load more integrations
            </Button>
          )}
        </div>
      )}
      {selected && (
        <section
          aria-label="Integration details"
          className="space-y-5 rounded-lg border border-slate-200 bg-white p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="break-words text-lg font-semibold">{selected.name}</h3>
              {selected.purpose && (
                <p className="mt-1 break-words text-sm text-slate-500">{selected.purpose}</p>
              )}
            </div>
            {selected.status !== 'REVOKED' && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setEditing(true);
                    setName(selected.name);
                    setPurpose(selected.purpose ?? '');
                    setScopes(selected.scopes);
                  }}
                >
                  Edit access
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => action(toggle)}>
                  {selected.status === 'ACTIVE' ? 'Suspend' : 'Resume'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setConfirm({ kind: 'revoke' })}
                >
                  Revoke integration
                </Button>
              </div>
            )}
          </div>
          <ul className="flex flex-wrap gap-2" aria-label="Granted permissions">
            {selected.scopes.map((s) => (
              <li key={s} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                {scopeNames[s]}
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">
            Authorized by {selected.authorizerName ?? 'an organizer or chair'}. Access depends on
            them retaining their role and two-factor authentication.
          </p>
          {selected.status !== 'REVOKED' && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setConfirm({ kind: 'reauthorize' })}
            >
              Authorize under my account
            </Button>
          )}
          {confirm && (
            <div
              role="alert"
              className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4"
            >
              <p className="text-sm text-amber-900">
                {confirm.kind === 'reauthorize'
                  ? 'Authorize this integration under your account? All existing keys will be revoked.'
                  : confirm.kind === 'revoke'
                    ? 'Revoke this integration and all its keys? This cannot be undone.'
                    : 'Revoke this key? The bot using it will lose access immediately.'}
              </p>
              <div className="flex gap-2">
                <Button disabled={busy} size="sm" onClick={() => action(confirmed)}>
                  Confirm {confirm.kind === 'reauthorize' ? 'authorization' : 'revocation'}
                </Button>
                <Button
                  disabled={busy}
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirm(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <h4 className="font-medium">API keys</h4>
            <Button
              size="sm"
              disabled={
                busy ||
                selected.status !== 'ACTIVE' ||
                selected.keys.filter((k) => !k.revokedAt && new Date(k.expiresAt) > new Date())
                  .length >= 2
              }
              onClick={() => {
                setIssuing(true);
                setKeyScopes(
                  selected.scopes.includes('papers:read')
                    ? ['papers:read']
                    : selected.scopes.includes('reviewers:read')
                      ? ['reviewers:read']
                      : ['analytics:read'],
                );
                setSecret(null);
              }}
            >
              Issue key
            </Button>
          </div>
          <p className="text-sm text-slate-500">
            Keep up to two active keys to rotate without interrupting your bot. Keys expire within
            90 days.
          </p>
          {issuing && (
            <form
              aria-label="Issue API key"
              className="space-y-4 rounded-md bg-slate-50 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void action(issue);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium">
                  Key label
                  <Input
                    required
                    maxLength={100}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Expires in days
                  <Input
                    type="number"
                    required
                    min={1}
                    max={90}
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                  />
                </label>
              </div>
              <ScopePicker allowed={selected.scopes} value={keyScopes} onChange={setKeyScopes} />
              <div className="flex gap-2">
                <Button type="submit" disabled={busy || !keyScopes.length}>
                  {busy ? 'Issuing…' : 'Create key'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setIssuing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
          {secret && (
            <div className="space-y-3 rounded-md border border-indigo-200 bg-indigo-50 p-4">
              <label
                htmlFor="one-time-api-key"
                className="block text-sm font-semibold text-indigo-950"
              >
                Copy your key now
              </label>
              <p className="text-sm text-indigo-900">
                This is the only time it will be shown. Store it in your bot’s secret manager.
              </p>
              <textarea
                ref={secretRef}
                id="one-time-api-key"
                readOnly
                value={secret}
                rows={3}
                className="w-full resize-none break-all rounded border border-indigo-200 bg-white p-3 font-mono text-xs focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    action(async () => {
                      await navigator.clipboard.writeText(secret);
                      setCopied(true);
                    })
                  }
                >
                  {copied ? 'Copied' : 'Copy key'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    action(async () => {
                      const response = await fetch(
                        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/integrations/v1/conferences/${conferenceId}/capabilities`,
                        {
                          headers: { Authorization: `Bearer ${secret}` },
                          credentials: 'omit',
                          cache: 'no-store',
                        },
                      );
                      if (!response.ok)
                        throw new Error(
                          `Access check failed (${response.status}). Refresh or issue a new key.`,
                        );
                      const result: { scopes: IntegrationScope[] } = await response.json();
                      setTestAccess(
                        `Access confirmed: ${result.scopes.map((s) => scopeNames[s]).join(', ')}`,
                      );
                    })
                  }
                >
                  Test access
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSecret(null)}>
                  I have saved it
                </Button>
              </div>
              {testAccess && (
                <p role="status" className="text-sm text-indigo-900">
                  {testAccess}
                </p>
              )}
            </div>
          )}
          {!selected.keys.length && <p className="text-sm text-slate-500">No keys issued yet.</p>}
          <ul className="divide-y divide-slate-100">
            {selected.keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium">
                    {k.label}{' '}
                    <span className="font-normal text-slate-500">
                      ·{' '}
                      {k.revokedAt
                        ? 'Revoked'
                        : new Date(k.expiresAt) <= new Date()
                          ? 'Expired'
                          : 'Active'}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Expires {date(k.expiresAt)} · Last used {date(k.lastUsedAt)}
                  </p>
                </div>
                {!k.revokedAt && selected.status !== 'REVOKED' && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => setConfirm({ kind: 'revokeKey', keyId: k.id })}
                  >
                    Revoke key
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-100 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="font-medium">Recent API access</h4>
                <p className="mt-1 text-xs text-slate-500">
                  30-day history. Request metadata only.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => action(() => access())}
              >
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Load access log
              </Button>
            </div>
            {logs && (
              <>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b text-slate-500">
                      <tr>
                        <th className="py-2 pr-4">Time (UTC)</th>
                        <th className="pr-4">Endpoint</th>
                        <th className="pr-4">Status</th>
                        <th className="pr-4">Results</th>
                        <th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((l) => (
                        <tr className="border-b border-slate-100" key={l.id}>
                          <td className="whitespace-nowrap py-3 pr-4">{date(l.observedAt)}</td>
                          <td className="pr-4 font-mono">{l.route}</td>
                          <td className="pr-4">{l.status}</td>
                          <td className="pr-4">{l.resultCount}</td>
                          <td>{l.durationMs} ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!logs.length && (
                  <p className="mt-4 text-sm text-slate-500">No API requests recorded yet.</p>
                )}
                {logCursor && (
                  <Button
                    className="mt-3"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => action(() => access(logCursor))}
                  >
                    Load more requests
                  </Button>
                )}
              </>
            )}
          </div>
          <div className="border-t border-slate-100 pt-5 text-sm text-slate-600">
            <p className="font-medium text-slate-800">Connect your bot</p>
            <p className="mt-1">
              Send the key as a Bearer token. Use the header Authorization: Bearer YOUR_API_KEY.
              Start with the capabilities endpoint to check its permissions.
            </p>
            <code className="mt-3 block break-all rounded bg-slate-50 p-3 text-xs">
              {process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}
              /integrations/v1/conferences/{conferenceId}/capabilities
            </code>
          </div>
        </section>
      )}
    </div>
  );
}

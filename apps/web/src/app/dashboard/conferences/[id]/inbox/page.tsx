'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Bell, Check, FileText, MessageSquare, RefreshCw, Users } from 'lucide-react';
import type { InboxItem, InboxKind } from '@openconferences/schemas';
import { apiClient } from '@/lib/api-client';
import { canCoordinateReview } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/dashboard/page-header';
import { useConferenceWorkspace } from '@/components/dashboard/conference-workspace';
import { notifyUpdatesRead } from '@/components/dashboard/conference-update-bell';

export default function InboxPage() {
  const { id } = useParams<{ id: string }>();
  const { conference } = useConferenceWorkspace();
  const coordinator = canCoordinateReview(conference?.myRoles ?? []);
  const [selectedKind, setKind] = useState<InboxKind | null>(null);
  const kind =
    selectedKind === 'CONFERENCE' && !coordinator
      ? 'REVIEW'
      : (selectedKind ?? (coordinator ? 'CONFERENCE' : 'REVIEW'));
  const [items, setItems] = useState<InboxItem[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [observedAt, setObservedAt] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState<string | null>(null);
  const key = `${id}/${kind}/${cursor ?? ''}/${unreadOnly}`;
  const activeKey = useRef(key);
  activeKey.current = key;
  const previousKey = useRef<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const result = await apiClient.messaging.listInbox({
          params: { id },
          query: {
            kind,
            cursor,
            ...(kind === 'CONFERENCE' && unreadOnly ? { unread: 'true' as const } : {}),
          },
        });
        if (cancelled) return;
        if (result.status !== 200) throw new Error('Could not load updates. Try Refresh.');
        setItems(result.body.data);
        setNextCursor(result.body.nextCursor);
        setObservedAt(result.body.observedAt);
        setError(null);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Could not load updates. Try Refresh.');
      } finally {
        if (!cancelled) {
          setLoading(false);
          timer = setTimeout(refreshVisible, 30000);
        }
      }
    }
    function refreshVisible() {
      if (cancelled) return;
      if (document.hidden) timer = setTimeout(refreshVisible, 30000);
      else void load();
    }
    setLoading(true);
    if (previousKey.current !== key) {
      setItems([]);
      setNextCursor(null);
      setObservedAt(undefined);
      setError(null);
    }
    previousKey.current = key;
    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, kind, cursor, unreadOnly, revision, key]);

  async function markRead(item: InboxItem) {
    const scopeKey = key;
    setSaving(item.id);
    try {
      const result = await apiClient.messaging.readInbox({
        params: { id },
        body: { kind: item.kind, sourceId: item.id, version: item.version },
      });
      if (result.status !== 200) throw new Error('Could not mark this update read. Try again.');
      if (activeKey.current === scopeKey) {
        setError(null);
        setItems((current) =>
          current.map((row) =>
            row.id === item.id && row.version === item.version ? { ...row, unread: false } : row,
          ),
        );
        if (unreadOnly) setRevision((value) => value + 1);
      }
      notifyUpdatesRead(id);
    } catch (err) {
      if (activeKey.current === scopeKey)
        setError(err instanceof Error ? err.message : 'Could not save read status.');
    } finally {
      setSaving(null);
    }
  }
  async function markAllRead() {
    if (!observedAt) return;
    const scopeKey = key;
    setSaving('all');
    try {
      const result = await apiClient.messaging.readAllConferenceUpdates({
        params: { id },
        body: { before: observedAt },
      });
      if (result.status !== 200) throw new Error('Could not mark updates read. Try again.');
      if (activeKey.current === scopeKey) {
        setError(null);
        setRevision((value) => value + 1);
      }
      notifyUpdatesRead(id);
    } catch (err) {
      if (activeKey.current === scopeKey)
        setError(err instanceof Error ? err.message : 'Could not save read status.');
    } finally {
      setSaving(null);
    }
  }
  function selectKind(value: InboxKind) {
    setKind(value);
    setCursor(undefined);
    setUnreadOnly(false);
  }
  const unread = items.filter((item) => item.unread).length;
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Updates"
        description="Short updates from this conference."
        actions={
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => setRevision((value) => value + 1)}
          >
            <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />
      <nav aria-label="Update type" className="flex flex-wrap gap-2">
        {coordinator ? (
          <Button
            aria-pressed={kind === 'CONFERENCE'}
            variant={kind === 'CONFERENCE' ? 'default' : 'outline'}
            onClick={() => selectKind('CONFERENCE')}
          >
            Conference activity
          </Button>
        ) : null}
        <Button
          aria-pressed={kind === 'REVIEW'}
          variant={kind === 'REVIEW' ? 'default' : 'outline'}
          onClick={() => selectKind('REVIEW')}
        >
          Reviews of my papers
        </Button>
        <Button
          aria-pressed={kind === 'REBUTTAL'}
          variant={kind === 'REBUTTAL' ? 'default' : 'outline'}
          onClick={() => selectKind('REBUTTAL')}
        >
          Author responses
        </Button>
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {kind === 'CONFERENCE' ? (
          <div className="flex gap-1" role="group" aria-label="Read status filter">
            <Button
              size="sm"
              variant={unreadOnly ? 'ghost' : 'outline'}
              aria-pressed={!unreadOnly}
              onClick={() => {
                setUnreadOnly(false);
                setCursor(undefined);
              }}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={unreadOnly ? 'outline' : 'ghost'}
              aria-pressed={unreadOnly}
              onClick={() => {
                setUnreadOnly(true);
                setCursor(undefined);
              }}
            >
              Unread
            </Button>
          </div>
        ) : (
          <p className="text-sm text-slate-600">Read status is saved to your account.</p>
        )}
        {kind === 'CONFERENCE' ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={loading || saving !== null || !observedAt || !!error}
            onClick={() => void markAllRead()}
          >
            <Check aria-hidden="true" className="mr-1.5 h-4 w-4" />
            {saving === 'all' ? 'Saving…' : 'Mark all read'}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
        >
          {error}
          {items.length ? ' Showing the last loaded updates.' : ''}
        </p>
      ) : null}
      {loading ? (
        <p role="status" className="text-sm text-slate-600">
          Loading updates…
        </p>
      ) : (
        <>
          {!items.length && !error ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
              <Bell className="mx-auto mb-3 h-6 w-6 text-slate-500" aria-hidden="true" />
              <p className="font-semibold text-slate-900">
                {unreadOnly ? 'You’re all caught up.' : 'No updates yet.'}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {unreadOnly
                  ? 'There are no unread updates in this view.'
                  : kind === 'CONFERENCE'
                    ? 'New submissions and review activity will appear here.'
                    : kind === 'REVIEW'
                      ? 'Released reviews of your papers will appear here.'
                      : 'Submitted author responses will appear here.'}
              </p>
            </div>
          ) : null}
          {items.length ? (
            <ul
              aria-label="Updates"
              className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              {items.map((item) => {
                const Icon = item.eventType?.startsWith('INVITATION')
                  ? Users
                  : item.eventType?.startsWith('PAPER')
                    ? FileText
                    : MessageSquare;
                return (
                  <li
                    key={item.id}
                    className={`flex gap-3 p-4 sm:gap-4 sm:p-5 ${item.unread ? 'bg-indigo-50/40' : ''}`}
                  >
                    <Icon
                      aria-hidden="true"
                      className={`mt-0.5 h-5 w-5 shrink-0 ${item.unread ? 'text-indigo-700' : 'text-slate-500'}`}
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <p
                          className={`break-words text-sm text-slate-900 ${item.unread ? 'font-semibold' : 'font-medium'}`}
                        >
                          {item.title}
                        </p>
                        <span
                          className={`text-xs ${item.unread ? 'font-medium text-indigo-700' : 'text-slate-600'}`}
                        >
                          {item.unread ? 'Unread' : 'Read'}
                        </span>
                      </div>
                      {item.subject ? (
                        <p className="max-w-prose break-words text-sm leading-6 text-slate-700">
                          {item.subject}
                        </p>
                      ) : null}
                      <time
                        dateTime={item.updatedAt}
                        title={item.updatedAt}
                        className="block text-xs text-slate-600"
                      >
                        {new Date(item.updatedAt).toLocaleString()}
                      </time>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Button asChild size="sm" variant="outline">
                          <Link
                            href={item.href}
                            onClick={() => {
                              if (item.unread && saving === null) void markRead(item);
                            }}
                          >
                            Open{' '}
                            {kind !== 'CONFERENCE'
                              ? kind === 'REVIEW'
                                ? 'reviews'
                                : 'response'
                              : item.paperId
                                ? 'paper'
                                : 'reviewers'}
                          </Link>
                        </Button>
                        {item.unread ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={saving !== null}
                            onClick={() => void markRead(item)}
                          >
                            {saving === item.id ? 'Saving…' : 'Mark read'}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {items.length ? (
            <p className="text-xs text-slate-600">
              {unread} unread on this page. Updates refresh every 30 seconds while visible.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {cursor ? (
              <Button variant="outline" onClick={() => setCursor(undefined)}>
                Newest updates
              </Button>
            ) : null}
            {nextCursor ? (
              <Button variant="outline" onClick={() => setCursor(nextCursor)}>
                Older updates
              </Button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

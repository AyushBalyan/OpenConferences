'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Check,
  FileText,
  MessageSquare,
  RefreshCw,
  Users,
  Search,
  ArrowUpRight,
} from 'lucide-react';
import type { InboxItem, InboxKind } from '@openconferences/schemas';
import { apiClient } from '@/lib/api-client';
import { canCoordinateReview } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { useConferenceWorkspace } from '@/components/dashboard/conference-workspace';
import { notifyUpdatesRead } from '@/components/dashboard/conference-update-bell';

type UpdateView = InboxKind | 'INVITATIONS';

export default function InboxPage() {
  const { id } = useParams<{ id: string }>();
  const { conference } = useConferenceWorkspace();
  const coordinator = canCoordinateReview(conference?.myRoles ?? []);
  const [selectedKind, setKind] = useState<UpdateView | null>(null);
  const view =
    (selectedKind === 'CONFERENCE' || selectedKind === 'INVITATIONS') && !coordinator
      ? 'REVIEW'
      : (selectedKind ?? (coordinator ? 'CONFERENCE' : 'REVIEW'));
  const kind: InboxKind = view === 'INVITATIONS' ? 'CONFERENCE' : view;
  const [response, setResponse] = useState<'ACCEPTED' | 'DECLINED' | undefined>();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [previous, setPrevious] = useState<Array<string | undefined>>([]);
  const filters =
    kind === 'CONFERENCE'
      ? {
          category: view === 'INVITATIONS' ? ('INVITATIONS' as const) : ('ACTIVITY' as const),
          ...(view === 'INVITATIONS' && response ? { response } : {}),
          ...(q ? { q } : {}),
        }
      : {};
  const [items, setItems] = useState<InboxItem[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [observedAt, setObservedAt] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState<string | null>(null);
  const key = `${id}/${view}/${response ?? ''}/${q}/${cursor ?? ''}/${unreadOnly}`;
  const activeKey = useRef(key);
  activeKey.current = key;
  const previousKey = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (search.trim() === q) return;
    const timer = setTimeout(() => {
      setQ(search.trim());
      setCursor(undefined);
      setPrevious([]);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, q]);

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
            ...filters,
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
    // key includes the complete server filter; stale responses are discarded by cleanup.
  }, [key, revision]);

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
        body: { before: observedAt, ...filters },
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
  function selectKind(value: UpdateView) {
    setKind(value);
    setResponse(undefined);
    setSearch('');
    setQ('');
    setPrevious([]);
    setCursor(undefined);
    setUnreadOnly(false);
  }
  const unread = items.filter((item) => item.unread).length;
  const viewTitle =
    view === 'INVITATIONS'
      ? 'Reviewer invitations'
      : view === 'CONFERENCE'
        ? 'Conference activity'
        : view === 'REVIEW'
          ? 'Reviews of my papers'
          : 'Author responses';
  const detail =
    view === 'INVITATIONS'
      ? 'Acceptance and decline responses from invited reviewers.'
      : view === 'CONFERENCE'
        ? 'Submission and review activity across your conference.'
        : view === 'REVIEW'
          ? 'Feedback released to you as an author.'
          : 'Responses from authors of papers you reviewed.';
  const resetPage = () => {
    setCursor(undefined);
    setPrevious([]);
  };
  return (
    <div className="w-full space-y-5 text-slate-900">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 hidden text-xs font-medium text-slate-600 sm:block">
            {conference?.name ?? 'Conference workspace'}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Updates</h1>
          <p className="mt-1 hidden text-sm text-slate-600 sm:block">
            Keep up with your conference. Read, filter and follow up in one place.
          </p>
        </div>
        <Button
          variant="outline"
          className="shrink-0"
          disabled={loading}
          onClick={() => setRevision((value) => value + 1)}
        >
          <RefreshCw
            aria-hidden="true"
            className={`mr-2 h-4 w-4 ${loading ? 'motion-safe:animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </header>
      <nav
        aria-label="Update type"
        className="flex gap-5 overflow-x-auto border-b border-slate-200"
      >
        {(
          [
            ...(coordinator
              ? [
                  { value: 'CONFERENCE', label: 'Conference activity' },
                  { value: 'INVITATIONS', label: 'Reviewer invitations' },
                ]
              : []),
            { value: 'REVIEW', label: 'Reviews of my papers' },
            { value: 'REBUTTAL', label: 'Author responses' },
          ] as Array<{ value: UpdateView; label: string }>
        ).map((tab) => (
          <button
            key={tab.value}
            type="button"
            aria-pressed={view === tab.value}
            onClick={() => selectKind(tab.value)}
            className={`shrink-0 border-b-2 px-1 py-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600 ${view === tab.value ? 'border-slate-900 font-semibold text-slate-900' : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <section
        className="overflow-hidden rounded-xl border border-slate-200 bg-white"
        aria-label={viewTitle}
      >
        <div className="space-y-4 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold sm:text-base">{viewTitle}</h2>
              <p className="sr-only mt-1 text-sm text-slate-600 sm:not-sr-only">{detail}</p>
            </div>
            {kind === 'CONFERENCE' ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={loading || saving !== null || !observedAt || !!error || !items.length}
                title="Mark all matching updates read, including older pages"
                onClick={() => void markAllRead()}
              >
                <Check aria-hidden="true" className="mr-1.5 h-4 w-4" />
                {saving === 'all' ? 'Saving…' : 'Mark all read'}
              </Button>
            ) : null}
          </div>
          {view === 'INVITATIONS' ? (
            <div
              role="group"
              aria-label="Invitation response"
              className="flex gap-1 rounded-lg bg-slate-100 p-1 sm:w-fit"
            >
              {(
                [
                  { value: undefined, label: 'All responses' },
                  { value: 'ACCEPTED', label: 'Accepted' },
                  { value: 'DECLINED', label: 'Declined' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.label}
                  type="button"
                  aria-pressed={response === tab.value}
                  onClick={() => {
                    setResponse(tab.value);
                    resetPage();
                  }}
                  className={`min-h-9 flex-1 whitespace-nowrap rounded-md px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-600 ${response === tab.value ? 'bg-white font-medium text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : null}
          {kind === 'CONFERENCE' ? (
            <div className="flex items-center justify-between gap-2">
              <div className="relative min-w-0 flex-1 sm:max-w-sm">
                <Search
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                />
                <input
                  aria-label="Search updates"
                  placeholder={
                    view === 'INVITATIONS' ? 'Search responses' : 'Search conference activity'
                  }
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  maxLength={200}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600"
                />
              </div>
              <div role="group" aria-label="Read status filter" className="flex items-center gap-1">
                {['All', 'Unread'].map((label) => (
                  <Button
                    key={label}
                    size="sm"
                    variant={unreadOnly === (label === 'Unread') ? 'outline' : 'ghost'}
                    aria-pressed={unreadOnly === (label === 'Unread')}
                    onClick={() => {
                      setUnreadOnly(label === 'Unread');
                      resetPage();
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-600">Read status is saved to your account.</p>
          )}
        </div>
        {error ? (
          <div
            role="alert"
            className="m-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
          >
            {error}
            {items.length ? ' Showing the last loaded updates.' : ''}
          </div>
        ) : null}
        {loading ? (
          <div role="status" className="space-y-4 px-5 py-8">
            <p className="text-sm text-slate-600">Loading updates…</p>
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
          </div>
        ) : (
          <>
            {!items.length && !error ? (
              <div className="px-6 py-12 text-center">
                <Bell className="mx-auto mb-3 h-6 w-6 text-slate-500" aria-hidden="true" />
                <p className="font-semibold">
                  {unreadOnly
                    ? 'You’re all caught up.'
                    : q
                      ? 'No matching updates.'
                      : view === 'INVITATIONS'
                        ? `No ${response ? response.toLowerCase() + ' ' : ''}responses yet.`
                        : 'No updates yet.'}
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                  {q
                    ? 'Try a different name or search phrase.'
                    : unreadOnly
                      ? 'There are no unread updates in this view.'
                      : view === 'INVITATIONS'
                        ? 'When a reviewer accepts or declines an invitation, their response will appear here.'
                        : kind === 'CONFERENCE'
                          ? 'New submissions and review activity will appear here.'
                          : kind === 'REVIEW'
                            ? 'Released reviews of your papers will appear here.'
                            : 'Submitted author responses will appear here.'}
                </p>
                {q || unreadOnly ? (
                  <Button
                    className="mt-3"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      setQ('');
                      setUnreadOnly(false);
                      resetPage();
                    }}
                  >
                    Clear filters
                  </Button>
                ) : null}
              </div>
            ) : null}
            {items.length ? (
              <ul aria-label="Updates" className="divide-y divide-slate-100">
                {items.map((item) => {
                  const invitation = item.eventType?.startsWith('INVITATION');
                  const accepted = item.eventType === 'INVITATION_ACCEPTED';
                  const Icon = invitation
                    ? Users
                    : item.eventType?.startsWith('PAPER')
                      ? FileText
                      : MessageSquare;
                  return (
                    <li key={item.id} className="flex gap-3 px-4 py-4 sm:gap-4 sm:px-5">
                      <Icon aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                          <p
                            className={`flex min-w-0 items-center gap-2 text-sm ${item.unread ? 'font-semibold' : 'font-medium'}`}
                          >
                            {item.unread ? (
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-700"
                                aria-hidden="true"
                              />
                            ) : null}
                            <span className="break-words">{item.title}</span>
                          </p>
                          <time
                            dateTime={item.updatedAt}
                            title={new Date(item.updatedAt).toUTCString()}
                            className="text-xs tabular-nums text-slate-600"
                          >
                            {new Date(item.updatedAt).toLocaleString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </time>
                        </div>
                        {item.subject ? (
                          <p className="mt-1 break-words text-sm leading-6 text-slate-700">
                            {item.subject}
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                          {invitation ? (
                            <span
                              className={`rounded px-2 py-0.5 text-xs font-medium ${accepted ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}
                            >
                              {accepted ? 'Accepted' : 'Declined'}
                            </span>
                          ) : null}
                          <span className="text-xs text-slate-600">
                            {item.unread ? 'Unread' : 'Read'}
                          </span>
                          <Link
                            href={
                              invitation
                                ? `/dashboard/conferences/${id}/reviews/assignments/invites`
                                : item.href
                            }
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-900 underline-offset-4 hover:underline"
                          >
                            {invitation ? 'View invitations' : 'Open update'}
                            <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                          </Link>
                          {item.unread ? (
                            <button
                              type="button"
                              disabled={saving !== null}
                              onClick={() => void markRead(item)}
                              className="min-h-8 text-xs font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline disabled:opacity-50"
                            >
                              {saving === item.id ? 'Saving…' : 'Mark read'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:px-5">
              <p className="text-xs text-slate-600" aria-live="polite">
                {items.length
                  ? `${items.length} update${items.length === 1 ? '' : 's'} · ${unread} unread on this page`
                  : error
                    ? 'Updates unavailable'
                    : '0 updates'}
                <span className="mt-1 block text-slate-500">
                  Refreshes every 30 seconds while visible.
                </span>
              </p>
              <nav aria-label="Update pages" className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!previous.length}
                  onClick={() => {
                    setCursor(previous.at(-1));
                    setPrevious((values) => values.slice(0, -1));
                  }}
                >
                  Newer updates
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!nextCursor || !!error}
                  onClick={() => {
                    setPrevious((values) => [...values, cursor]);
                    setCursor(nextCursor!);
                  }}
                >
                  Older updates
                </Button>
              </nav>
            </footer>
          </>
        )}
      </section>
      {view === 'INVITATIONS' ? (
        <p className="text-xs leading-5 text-slate-600">
          This feed records reviewer responses. Manage pending invitations and share links in{' '}
          <Link
            className="font-medium text-slate-900 underline underline-offset-4"
            href={`/dashboard/conferences/${id}/reviews/assignments/invites`}
          >
            Reviewer invitations
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}

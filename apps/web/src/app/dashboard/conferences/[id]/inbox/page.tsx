'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/dashboard/page-header';

type Item = {
  id: string;
  kind: 'REVIEW' | 'REBUTTAL';
  version: number;
  title: string;
  updatedAt: string;
  unread: boolean;
  href: string;
};

export default function InboxPage() {
  const { id } = useParams<{ id: string }>();
  const [kind, setKind] = useState<'REVIEW' | 'REBUTTAL'>('REVIEW');
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const result = await apiClient.messaging.listInbox({
          params: { id },
          query: { kind, cursor },
        });
        if (cancelled) return;
        if (result.status !== 200)
          throw new Error('Could not load your updates. Please try again.');
        setItems(result.body.data);
        setNextCursor(result.body.nextCursor);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load updates.');
      } finally {
        if (!cancelled) {
          setLoading(false);
          const refreshWhenVisible = () => {
            if (cancelled) return;
            if (document.hidden) timer = setTimeout(refreshWhenVisible, 30000);
            else void load();
          };
          timer = setTimeout(refreshWhenVisible, 30000);
        }
      }
    }
    setLoading(true);
    setItems([]);
    setNextCursor(null);
    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, kind, cursor, revision]);

  async function markRead(item: Item) {
    setSaving(item.id);
    try {
      const result = await apiClient.messaging.readInbox({
        params: { id },
        body: { kind: item.kind, sourceId: item.id, version: item.version },
      });
      if (result.status !== 200)
        throw new Error('Could not mark this update read. Refresh and try again.');
      setError(null);
      setItems((current) =>
        current.map((row) =>
          row.id === item.id && row.version === item.version ? { ...row, unread: false } : row,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save read state.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Updates"
        description="Released reviews and author responses. Read status is saved to your account."
      />
      <nav aria-label="Update type" className="flex flex-wrap gap-2">
        <Button
          aria-pressed={kind === 'REVIEW'}
          variant={kind === 'REVIEW' ? 'default' : 'outline'}
          onClick={() => {
            setKind('REVIEW');
            setCursor(undefined);
          }}
        >
          Reviews of my papers
        </Button>
        <Button
          aria-pressed={kind === 'REBUTTAL'}
          variant={kind === 'REBUTTAL' ? 'default' : 'outline'}
          onClick={() => {
            setKind('REBUTTAL');
            setCursor(undefined);
          }}
        >
          Author responses
        </Button>
        <Button variant="outline" onClick={() => setRevision((value) => value + 1)}>
          Refresh
        </Button>
      </nav>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p role="status">Loading updates…</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {items.filter((item) => item.unread).length} unread on this page. Updates refresh every
            30 seconds while visible.
          </p>
          {!items.length && !error ? (
            <p>
              No {kind === 'REVIEW' ? 'released reviews' : 'submitted author responses'} are
              available to you on this page.
            </p>
          ) : null}
          <ul className="divide-y rounded border">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 space-y-1 break-words">
                  <p className={item.unread ? 'font-semibold' : ''}>{item.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.unread ? 'New or updated · ' : 'Read · '}
                    {new Date(item.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button asChild variant="outline">
                    <Link href={item.href}>Open {kind === 'REVIEW' ? 'reviews' : 'response'}</Link>
                  </Button>
                  {item.unread ? (
                    <Button
                      variant="outline"
                      disabled={saving !== null}
                      onClick={() => void markRead(item)}
                    >
                      {saving === item.id ? 'Saving…' : 'Mark read'}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
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

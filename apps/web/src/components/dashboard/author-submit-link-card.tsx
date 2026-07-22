'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fetchAuthorJoinLink, rotateAuthorJoinLink } from '@/lib/api-client';

type AuthorSubmitLinkCardProps = {
  conferenceId: string;
  cfpOpen?: boolean;
};

export function AuthorSubmitLinkCard({ conferenceId, cfpOpen }: AuthorSubmitLinkCardProps) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const link = await fetchAuthorJoinLink(conferenceId);
    setToken(link.token);
  }, [conferenceId]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load submit link'))
      .finally(() => setLoading(false));
  }, [load]);

  const submitUrl = useMemo(() => {
    if (!token || typeof window === 'undefined') return '';
    return `${window.location.origin}/join/author?token=${token}`;
  }, [token]);

  async function handleCopy() {
    if (!submitUrl) return;
    await navigator.clipboard.writeText(submitUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function handleRotate() {
    setBusy(true);
    setError(null);
    try {
      const link = await rotateAuthorJoinLink(conferenceId);
      setToken(link.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rotate submit link');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Public submit link</CardTitle>
        <CardDescription>
          Share this link on your conference website. Authors who open it get access to submit while
          CFP is open.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {cfpOpen === false ? (
          <p className="text-sm text-amber-700">
            CFP is not open yet. The link will grant author access only after you open the call for
            papers.
          </p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            readOnly
            value={loading ? 'Loading submit link…' : submitUrl}
            className="font-mono text-xs"
          />
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || !submitUrl}
              onClick={handleCopy}
            >
              <Copy className="mr-1.5 h-4 w-4" />
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || busy}
              onClick={handleRotate}
            >
              <RefreshCw className={`mr-1.5 h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
              Rotate
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

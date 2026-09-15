'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { downloadPaperVersion } from '@/lib/api-client';
import { paperHasCleanDownload, type PaperDto } from '@/lib/submission-types';

export function DownloadPaperButton({
  conferenceId,
  paper,
  size = 'sm',
  variant = 'outline',
  label = 'Download PDF',
  hideWhenUnavailable = false,
}: {
  conferenceId: string;
  paper: PaperDto;
  size?: 'default' | 'sm';
  variant?: 'default' | 'outline' | 'ghost';
  label?: string;
  hideWhenUnavailable?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const versionId = paper.currentVersionId;
  const available = paperHasCleanDownload(paper);

  if (hideWhenUnavailable && !available && !error) {
    return null;
  }

  async function onDownload() {
    if (!versionId) {
      setError('No clean PDF is available yet.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { downloadUrl } = await downloadPaperVersion(conferenceId, paper.id, versionId);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        size={size}
        variant={variant}
        disabled={!available || busy}
        onClick={() => {
          void onDownload();
        }}
      >
        <Download className="mr-2 h-4 w-4" />
        {busy ? 'Preparing…' : available ? label : 'PDF unavailable'}
      </Button>
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}

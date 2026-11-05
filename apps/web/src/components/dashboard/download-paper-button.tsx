'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { downloadPaperVersion } from '@/lib/api-client';
import {
  paperDownloadFilename,
  paperHasCleanDownload,
  saveUrlAsFile,
  type PaperDto,
} from '@/lib/submission-types';

export function DownloadPaperButton({
  conferenceId,
  paper,
  size = 'sm',
  variant = 'outline',
  label = 'Download PDF',
  hideWhenUnavailable = false,
  versionKind,
}: {
  conferenceId: string;
  paper: PaperDto;
  size?: 'default' | 'sm';
  variant?: 'default' | 'outline' | 'ghost';
  label?: string;
  hideWhenUnavailable?: boolean;
  versionKind?: 'CAMERA_READY';
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedVersion =
    versionKind === 'CAMERA_READY' ? paper.cameraReadyVersion : paper.currentVersion;
  const versionId = versionKind === 'CAMERA_READY' ? selectedVersion?.id : paper.currentVersionId;
  const available =
    versionKind === 'CAMERA_READY'
      ? Boolean(versionId) && selectedVersion?.fileAsset?.scanStatus === 'CLEAN'
      : paperHasCleanDownload(paper);

  if (hideWhenUnavailable && !available && !error) {
    return null;
  }

  async function onDownload() {
    if (!versionId || !available) {
      setError('No clean PDF is available yet.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { downloadUrl } = await downloadPaperVersion(conferenceId, paper.id, versionId);
      const filename = paperDownloadFilename(
        paper.submissionNumber,
        selectedVersion?.fileAsset?.originalFilename,
      );
      await saveUrlAsFile(downloadUrl, filename);
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

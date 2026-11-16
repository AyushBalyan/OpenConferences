'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, FileText } from 'lucide-react';
import { downloadPaperVersion, fetchPaper } from '@/lib/api-client';
import { paperHasCleanDownload } from '@/lib/submission-types';
import { useToast } from '@/components/ui/toast';

const LINK_CLASS =
  'inline-flex items-center gap-1.5 rounded text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60';

/** Shortcuts from a decision to the submission page and its current PDF. */
export function PaperLinks({ conferenceId, paperId }: { conferenceId: string; paperId: string }) {
  const toast = useToast();
  const [opening, setOpening] = useState(false);

  async function viewPdf() {
    // Open the tab during the click so pop-up blockers allow it, then point it
    // at the signed URL once that has been fetched.
    const tab = window.open('', '_blank');
    setOpening(true);
    try {
      const paper = await fetchPaper(conferenceId, paperId);
      if (!paper.currentVersionId || !paperHasCleanDownload(paper)) {
        throw new Error('No clean PDF is available for this paper yet.');
      }
      const { downloadUrl } = await downloadPaperVersion(
        conferenceId,
        paperId,
        paper.currentVersionId,
        'inline',
      );
      if (!tab) {
        throw new Error('The PDF could not open in a new tab. Allow pop-ups for this site.');
      }
      tab.opener = null;
      tab.location.href = downloadUrl;
    } catch (error) {
      tab?.close();
      toast.error(error instanceof Error ? error.message : 'Could not open the PDF.');
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <Link
        href={`/dashboard/conferences/${conferenceId}/submissions/${paperId}`}
        className={LINK_CLASS}
      >
        <ExternalLink className="size-4" aria-hidden />
        Open submission
      </Link>
      <button
        type="button"
        className={LINK_CLASS}
        disabled={opening}
        onClick={() => void viewPdf()}
      >
        <FileText className="size-4" aria-hidden />
        {opening ? 'Opening PDF…' : 'View PDF'}
      </button>
    </div>
  );
}

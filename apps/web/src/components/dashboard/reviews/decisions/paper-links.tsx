'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, FileText } from 'lucide-react';
import { currentPaperPdfUrl } from '@/lib/api-client';
import { openInNewTab } from '@/lib/open-in-tab';
import { useToast } from '@/components/ui/toast';

const LINK_CLASS =
  'inline-flex items-center gap-1.5 rounded text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60';

/** Shortcuts from a decision to the submission page and its current PDF. */
export function PaperLinks({ conferenceId, paperId }: { conferenceId: string; paperId: string }) {
  const toast = useToast();
  const [opening, setOpening] = useState(false);

  async function viewPdf() {
    setOpening(true);
    try {
      await openInNewTab(() => currentPaperPdfUrl(conferenceId, paperId));
    } catch (error) {
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

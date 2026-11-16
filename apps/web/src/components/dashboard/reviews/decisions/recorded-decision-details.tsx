'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { updateDecisionRationale } from '@/lib/api-client';
import type { DecisionDto } from '@/lib/review-types';
import { useDecisionsWorkspace } from './decisions-workspace';
import { PaperLinks } from './paper-links';
import { ReviewDossier } from './review-dossier';
import { ReviewReleaseControl } from './review-release';

const SECTION_HEADING = 'text-xs font-semibold uppercase tracking-wider text-slate-500';

/**
 * Everything behind a recorded decision: the message to authors (editable
 * until the decision is sent), review release, and the reviews themselves.
 */
export function RecordedDecisionDetails({
  decision,
  canEditMessage,
}: {
  decision: DecisionDto;
  /** True while the decision is current and has not been released to authors. */
  canEditMessage: boolean;
}) {
  const { conferenceId, busy, refresh } = useDecisionsWorkspace();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(decision.rationale ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldId = `decision-message-${decision.id}`;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateDecisionRationale(conferenceId, decision.id, {
        rationale: text.trim() || null,
        version: decision.version,
      });
      setEditing(false);
      toast.success('Message to authors saved.');
      await refresh().catch(() =>
        toast.error('Message saved, but the list could not refresh. Reload to see it.'),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the message.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section aria-label="Message to authors">
        <h3 id={`${fieldId}-label`} className={SECTION_HEADING}>
          Message to authors
        </h3>
        {editing ? (
          <div className="mt-2 max-w-2xl">
            <Textarea
              id={fieldId}
              aria-labelledby={`${fieldId}-label`}
              autoFocus
              className="min-h-[7rem] resize-y bg-white text-sm"
              maxLength={10000}
              disabled={saving}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Summarise the committee’s reasoning. Included in the decision email."
            />
            {error ? (
              <p role="alert" className="mt-2 text-sm text-rose-700">
                {error}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                className="bg-slate-900 shadow-none hover:bg-slate-800"
                disabled={saving || text.trim() === (decision.rationale ?? '')}
                onClick={() => void save()}
              >
                {saving ? 'Saving…' : 'Save message'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                  setText(decision.rationale ?? '');
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-2 max-w-2xl">
            {decision.rationale ? (
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
                {decision.rationale}
              </p>
            ) : (
              <p className="text-sm text-slate-600">
                {canEditMessage
                  ? 'No message yet. The decision email will go out without committee comments.'
                  : 'No message was included.'}
              </p>
            )}
            {canEditMessage ? (
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                disabled={busy}
                onClick={() => {
                  setText(decision.rationale ?? '');
                  setEditing(true);
                }}
              >
                {decision.rationale ? 'Edit message' : 'Add message'}
              </Button>
            ) : decision.notifiedAt ? (
              <p className="mt-2 text-xs text-slate-500">
                Already sent to the author, so it can no longer be changed.
              </p>
            ) : null}
          </div>
        )}
      </section>

      <section aria-label="Review release">
        <h3 className={SECTION_HEADING}>Review release</h3>
        <div className="mt-2">
          <ReviewReleaseControl cycleId={decision.roundId} />
        </div>
      </section>

      <section aria-label="Reviews">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className={SECTION_HEADING}>Reviews and scores</h3>
          <PaperLinks conferenceId={conferenceId} paperId={decision.paperId} />
        </div>
        <div className="mt-3">
          <ReviewDossier
            conferenceId={conferenceId}
            paperId={decision.paperId}
            roundId={decision.roundId}
          />
        </div>
      </section>
    </div>
  );
}

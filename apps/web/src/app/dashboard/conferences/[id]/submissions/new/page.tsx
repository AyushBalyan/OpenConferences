'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import {
  PdfUploadField,
  UploadProgressSteps,
  type UploadProgressStep,
} from '@/components/dashboard/pdf-upload-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  addAuthorship,
  createPaper,
  fetchPaper,
  submitPaper,
  updatePaper,
  uploadPaperPdf,
} from '@/lib/api-client';
import { getStoredAuthorAffiliation } from '@/lib/author-join-pending';
import { canSubmitDraft, latestScanStatus, type PaperDto } from '@/lib/submission-types';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Step = 'details' | 'authors' | 'upload';

export default function NewSubmissionPage() {
  return <SubmissionWizard />;
}

function SubmissionWizard() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const conferenceId = params.id;

  const [step, setStep] = useState<Step>('details');
  const [paper, setPaper] = useState<PaperDto | null>(null);

  const [title, setTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [keywords, setKeywords] = useState('');

  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [authorAffiliation, setAuthorAffiliation] = useState('');

  const [file, setFile] = useState<File | null>(null);
  const [pdfUploaded, setPdfUploaded] = useState(false);
  const [busy, setBusy] = useState<'uploading' | 'submitting' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scanStatus = paper ? latestScanStatus(paper) : undefined;
  const scanReady = Boolean(paper && pdfUploaded && canSubmitDraft(paper));
  const scanFailed = pdfUploaded && scanStatus === 'INFECTED';
  const scanning = pdfUploaded && !scanReady && !scanFailed && busy !== 'uploading';

  const uploadProgress: UploadProgressStep | null =
    busy === 'uploading' ? 'uploading' : scanning ? 'scanning' : scanReady ? 'ready' : null;

  useEffect(() => {
    if (!paper?.id || !pdfUploaded || scanReady || scanFailed || busy === 'uploading') {
      return;
    }

    const paperId = paper.id;
    let cancelled = false;

    async function refreshScan() {
      try {
        const latest = await fetchPaper(conferenceId, paperId);
        if (!cancelled) {
          setPaper(latest);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to check scan status');
        }
      }
    }

    void refreshScan();
    const timer = window.setInterval(() => {
      void refreshScan();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [busy, conferenceId, paper?.id, pdfUploaded, scanFailed, scanReady]);

  async function saveDetails(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const keywordList = keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      if (paper) {
        const updated = await updatePaper(conferenceId, paper.id, {
          title,
          abstract,
          keywords: keywordList,
          version: paper.version,
        });
        setPaper(updated);
      } else {
        const created = await createPaper(conferenceId, {
          title,
          abstract,
          keywords: keywordList,
          correspondingAffiliation: getStoredAuthorAffiliation() ?? undefined,
        });
        setPaper(created);
      }
      setStep('authors');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save details');
    }
  }

  async function saveAuthors(event: React.FormEvent) {
    event.preventDefault();
    if (!paper) return;
    setError(null);
    try {
      if (authorName && authorEmail) {
        await addAuthorship(conferenceId, paper.id, {
          fullName: authorName,
          email: authorEmail,
          affiliation: authorAffiliation || undefined,
        });
      }
      setStep('upload');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add author');
    }
  }

  async function uploadPdf() {
    if (!paper || !file) return;
    setError(null);
    setBusy('uploading');
    try {
      await uploadPaperPdf(conferenceId, paper.id, file);
      const latest = await fetchPaper(conferenceId, paper.id);
      setPaper(latest);
      setPdfUploaded(true);
    } catch (err) {
      setPdfUploaded(false);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(null);
    }
  }

  async function submitDraft() {
    if (!paper || !scanReady) return;
    setError(null);
    setBusy('submitting');
    try {
      await submitPaper(conferenceId, paper.id);
      router.push(`/dashboard/conferences/${conferenceId}/submissions/${paper.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
      setBusy(null);
    }
  }

  const keywordChips = keywords
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  const abstractWords = abstract.trim() ? abstract.trim().split(/\s+/).length : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="New submission"
        description="Three short steps: describe your paper, list co-authors, then upload the manuscript."
      />

      <WizardSteps current={step} />

      {error && step !== 'upload' ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error}
        </p>
      ) : null}

      {step === 'details' ? (
        <form
          onSubmit={saveDetails}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
        >
          <div className="space-y-6 p-6">
            <FormField
              label="Title"
              htmlFor="title"
              hint="Use the exact title from your manuscript."
            >
              <Input
                id="title"
                className="h-11 text-base"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </FormField>
            <FormField
              label="Abstract"
              htmlFor="abstract"
              aside={<span className="tabular-nums">{abstractWords} words</span>}
            >
              <textarea
                id="abstract"
                className="flex min-h-44 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[15px] leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500"
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
                required
              />
            </FormField>
            <FormField
              label="Keywords"
              htmlFor="keywords"
              hint="Separate with commas. Used to match reviewers."
            >
              <Input
                id="keywords"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="machine learning, peer review"
              />
              {keywordChips.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {keywordChips.map((chip, i) => (
                    <span
                      key={`${chip}-${i}`}
                      className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              ) : null}
            </FormField>
          </div>
          <StepFooter>
            <span />
            <Button type="submit">Continue to authors</Button>
          </StepFooter>
        </form>
      ) : null}

      {step === 'authors' ? (
        <form
          onSubmit={saveAuthors}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
        >
          <div className="space-y-6 p-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              You’re listed as the{' '}
              <span className="font-medium text-slate-900">corresponding author</span>. Add a
              co-author below, or continue if you’re the only author.
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Full name" htmlFor="authorName">
                <Input
                  id="authorName"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                />
              </FormField>
              <FormField label="Email" htmlFor="authorEmail">
                <Input
                  id="authorEmail"
                  type="email"
                  value={authorEmail}
                  onChange={(e) => setAuthorEmail(e.target.value)}
                />
              </FormField>
              <div className="sm:col-span-2">
                <FormField label="Affiliation" htmlFor="authorAffiliation" hint="Optional">
                  <Input
                    id="authorAffiliation"
                    value={authorAffiliation}
                    onChange={(e) => setAuthorAffiliation(e.target.value)}
                  />
                </FormField>
              </div>
            </div>
          </div>
          <StepFooter>
            <Button type="button" variant="ghost" onClick={() => setStep('details')}>
              Back
            </Button>
            <Button type="submit">
              {authorName && authorEmail ? 'Add and continue' : 'Skip to upload'}
            </Button>
          </StepFooter>
        </form>
      ) : null}

      {step === 'upload' ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="space-y-5 p-6">
            <p className="text-sm text-slate-600">
              Upload your manuscript as a PDF. Every file is scanned for security before you can
              submit.
            </p>
            <PdfUploadField
              file={file}
              onFileChange={(next) => {
                setFile(next);
                setPdfUploaded(false);
              }}
              disabled={busy !== null}
            />
            {uploadProgress ? <UploadProgressSteps current={uploadProgress} /> : null}
            {scanFailed ? (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
              >
                The uploaded PDF failed security scanning. Choose a different file and upload again.
              </p>
            ) : null}
            {error ? (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
              >
                {error}
              </p>
            ) : null}
          </div>
          <StepFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep('authors')}
              disabled={busy !== null}
            >
              Back
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void uploadPdf()}
                disabled={!file || busy !== null}
              >
                {busy === 'uploading' ? 'Uploading…' : pdfUploaded ? 'Replace PDF' : 'Upload PDF'}
              </Button>
              <Button
                type="button"
                onClick={() => void submitDraft()}
                disabled={!scanReady || busy !== null}
              >
                {busy === 'submitting' ? 'Submitting…' : 'Submit paper'}
              </Button>
            </div>
          </StepFooter>
        </div>
      ) : null}
    </div>
  );
}

function FormField({
  label,
  htmlFor,
  hint,
  aside,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <Label htmlFor={htmlFor} className="text-sm font-medium text-slate-900">
          {label}
        </Label>
        {aside ? <span className="text-xs text-slate-400">{aside}</span> : null}
      </div>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function StepFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-3.5">
      {children}
    </div>
  );
}

function WizardSteps({ current }: { current: Step }) {
  const steps: { id: Step; label: string; hint: string }[] = [
    { id: 'details', label: 'Details', hint: 'Title & abstract' },
    { id: 'authors', label: 'Authors', hint: 'Co-authors' },
    { id: 'upload', label: 'Manuscript', hint: 'PDF & submit' },
  ];
  const currentIndex = steps.findIndex((s) => s.id === current);

  return (
    <ol className="grid grid-cols-3 gap-3" aria-label="Submission steps">
      {steps.map((step, index) => {
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'active' : 'todo';
        return (
          <li key={step.id} aria-current={state === 'active' ? 'step' : undefined}>
            <div
              className={`h-1 rounded-full ${state === 'todo' ? 'bg-slate-200' : 'bg-indigo-600'}`}
            />
            <div className="mt-2.5 flex items-center gap-2">
              <span
                className={`flex size-5 items-center justify-center rounded-full text-[11px] font-semibold ${state === 'done' ? 'bg-indigo-600 text-white' : state === 'active' ? 'border-2 border-indigo-600 text-indigo-700' : 'border border-slate-300 text-slate-400'}`}
              >
                {state === 'done' ? '✓' : index + 1}
              </span>
              <span
                className={`text-sm font-medium ${state === 'todo' ? 'text-slate-400' : 'text-slate-900'}`}
              >
                {step.label}
              </span>
            </div>
            <p className="ml-7 text-xs text-slate-500">{step.hint}</p>
          </li>
        );
      })}
    </ol>
  );
}

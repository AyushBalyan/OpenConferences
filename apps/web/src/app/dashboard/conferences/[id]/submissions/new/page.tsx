'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import {
  PdfUploadField,
  UploadProgressSteps,
  type UploadProgressStep,
} from '@/components/dashboard/pdf-upload-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="New submission"
        description="Start a new paper submission for this conference."
      />

      <WizardSteps current={step} />

      {step === 'details' ? (
        <Card>
          <CardHeader>
            <CardTitle>Paper details</CardTitle>
            <CardDescription>Title, abstract, and keywords for your paper.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={saveDetails}>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="abstract">Abstract</Label>
                <textarea
                  id="abstract"
                  className="flex min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={abstract}
                  onChange={(e) => setAbstract(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="keywords">Keywords (comma-separated)</Label>
                <Input
                  id="keywords"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="machine learning, peer review"
                />
              </div>
              <Button type="submit">Continue to authors</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {step === 'authors' ? (
        <Card>
          <CardHeader>
            <CardTitle>Co-authors</CardTitle>
            <CardDescription>
              You are already listed as corresponding author. Add optional co-authors below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={saveAuthors}>
              <div className="space-y-2">
                <Label htmlFor="authorName">Co-author name</Label>
                <Input
                  id="authorName"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="authorEmail">Co-author email</Label>
                <Input
                  id="authorEmail"
                  type="email"
                  value={authorEmail}
                  onChange={(e) => setAuthorEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="authorAffiliation">Affiliation</Label>
                <Input
                  id="authorAffiliation"
                  value={authorAffiliation}
                  onChange={(e) => setAuthorAffiliation(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep('details')}>
                  Back
                </Button>
                <Button type="submit">Continue to upload</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {step === 'upload' ? (
        <Card>
          <CardHeader>
            <CardTitle>Upload PDF</CardTitle>
            <CardDescription>
              Upload your manuscript first. Submit stays disabled until the security scan reports
              clean.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
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
                className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                role="alert"
              >
                The uploaded PDF failed security scanning. Choose a different file and upload again.
              </p>
            ) : null}

            {error ? (
              <p
                className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('authors')}
                disabled={busy !== null}
              >
                Back
              </Button>
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
          </CardContent>
        </Card>
      ) : null}

      {error && step !== 'upload' ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function WizardSteps({ current }: { current: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'details', label: 'Details' },
    { id: 'authors', label: 'Authors' },
    { id: 'upload', label: 'Upload' },
  ];

  return (
    <ol className="flex gap-2 text-sm">
      {steps.map((step, index) => {
        const active = step.id === current;
        return (
          <li
            key={step.id}
            className={`rounded-full px-3 py-1 ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          >
            {index + 1}. {step.label}
          </li>
        );
      })}
    </ol>
  );
}

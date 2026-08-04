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
  submitPaper,
  updatePaper,
  uploadPaperPdf,
} from '@/lib/api-client';
import { getStoredAuthorAffiliation } from '@/lib/author-join-pending';
import type { PaperDto } from '@/lib/submission-types';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

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
  const [uploadProgress, setUploadProgress] = useState<UploadProgressStep | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function uploadAndSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!paper || !file) return;
    setError(null);
    setUploadProgress('uploading');
    try {
      await uploadPaperPdf(conferenceId, paper.id, file);
      setUploadProgress('scanning');
      await new Promise((r) => setTimeout(r, 300));
      setUploadProgress('submitting');
      await submitPaper(conferenceId, paper.id);
      router.push(`/dashboard/conferences/${conferenceId}/submissions/${paper.id}`);
    } catch (err) {
      setUploadProgress(null);
      setError(err instanceof Error ? err.message : 'Upload or submit failed');
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
              Add your manuscript as a PDF. It will be scanned for security before submission is
              finalized.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={uploadAndSubmit}>
              <PdfUploadField
                file={file}
                onFileChange={setFile}
                disabled={Boolean(uploadProgress)}
              />

              {uploadProgress ? <UploadProgressSteps current={uploadProgress} /> : null}

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
                  disabled={Boolean(uploadProgress)}
                >
                  Back
                </Button>
                <Button type="submit" disabled={!file || Boolean(uploadProgress)}>
                  {uploadProgress ? 'Working…' : 'Upload & submit'}
                </Button>
              </div>
            </form>
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

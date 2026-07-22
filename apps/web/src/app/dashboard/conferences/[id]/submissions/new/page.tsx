'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  addAuthorship,
  createPaper,
  fetchConference,
  fetchTracks,
  submitPaper,
  updatePaper,
  uploadPaperPdf,
} from '@/lib/api-client';
import { getStoredAuthorAffiliation } from '@/lib/author-join-pending';
import type { PaperDto } from '@/lib/submission-types';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type Step = 'details' | 'authors' | 'upload';

export default function NewSubmissionPage() {
  return <SubmissionWizard />;
}

function SubmissionWizard() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const conferenceId = params.id;

  const [step, setStep] = useState<Step>('details');
  const [, setConferenceName] = useState('');
  const [tracks, setTracks] = useState<{ id: string; name: string }[]>([]);
  const [paper, setPaper] = useState<PaperDto | null>(null);

  const [trackId, setTrackId] = useState('');
  const [title, setTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [keywords, setKeywords] = useState('');

  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [authorAffiliation, setAuthorAffiliation] = useState('');

  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [conference, trackList] = await Promise.all([
      fetchConference(conferenceId),
      fetchTracks(conferenceId),
    ]);
    setConferenceName(conference.name);
    setTracks(trackList);
    if (trackList[0]) setTrackId(trackList[0].id);
  }, [conferenceId]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [load]);

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
          trackId,
          title,
          abstract,
          keywords: keywordList,
          version: paper.version,
        });
        setPaper(updated);
      } else {
        const created = await createPaper(conferenceId, {
          trackId,
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
    setUploadProgress('Uploading PDF…');
    try {
      await uploadPaperPdf(conferenceId, paper.id, file);
      setUploadProgress('Scanning file…');
      await new Promise((r) => setTimeout(r, 300));
      setUploadProgress('Submitting…');
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
            <CardDescription>Title, abstract, and track selection.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={saveDetails}>
              <div className="space-y-2">
                <Label htmlFor="track">Track</Label>
                <select
                  id="track"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={trackId}
                  onChange={(e) => setTrackId(e.target.value)}
                  required
                >
                  {tracks.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.name}
                    </option>
                  ))}
                </select>
              </div>
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
              Upload your submission PDF. It will be scanned before submission.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={uploadAndSubmit}>
              <div className="space-y-2">
                <Label htmlFor="pdf">PDF file</Label>
                <Input
                  id="pdf"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  required
                />
              </div>
              {uploadProgress ? (
                <p className="text-sm text-muted-foreground">{uploadProgress}</p>
              ) : null}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep('authors')}>
                  Back
                </Button>
                <Button type="submit" disabled={!file || !!uploadProgress}>
                  Upload & submit
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
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

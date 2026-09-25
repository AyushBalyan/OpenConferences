'use client';

import type {
  OutreachCampaignDto,
  OutreachCampaignType,
  OutreachInvalidRow,
  OutreachPreviewDto,
  OutreachSenderDto,
  OutreachTemplateDto,
} from '@openconferences/schemas';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { SpreadsheetUploadField } from '@/components/dashboard/outreach/spreadsheet-upload-field';
import { SectionPageLayout } from '@/components/dashboard/section-page-layout';
import { outreachSenderCopy } from '@/lib/outreach-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createOutreachCampaign,
  fetchOutreachSender,
  fetchOutreachTemplates,
  importOutreachRecipients,
  previewOutreachCampaign,
  selectOutreachTemplate,
  sendOutreachCampaign,
} from '@/lib/api-client';
import { parseOutreachSpreadsheet } from '@/lib/outreach-spreadsheet';
import { isMfaRequiredError, mfaEnrollHref } from '@/lib/mfa-errors';

const STEPS = ['Create', 'Upload', 'Template', 'Preview', 'Send'] as const;
type Step = (typeof STEPS)[number];

const TYPE_OPTIONS: { value: OutreachCampaignType; label: string }[] = [
  { value: 'TPC_INVITATION', label: 'TPC invitation' },
  { value: 'PAPER_SUBMISSION_INVITATION', label: 'Paper submission invitation' },
  { value: 'GENERAL_OUTREACH', label: 'General conference outreach' },
];

export default function NewOutreachCampaignPage() {
  const params = useParams<{ id: string }>();
  const conferenceId = params.id;
  const router = useRouter();

  const [step, setStep] = useState<Step>('Create');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState<OutreachCampaignType>('TPC_INVITATION');
  const [campaign, setCampaign] = useState<OutreachCampaignDto | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [invalidRows, setInvalidRows] = useState<OutreachInvalidRow[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);

  const [templates, setTemplates] = useState<OutreachTemplateDto[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const [preview, setPreview] = useState<OutreachPreviewDto | null>(null);
  const [sender, setSender] = useState<OutreachSenderDto | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  function handleError(err: unknown, fallback: string) {
    if (isMfaRequiredError(err)) {
      router.push(mfaEnrollHref(`/dashboard/conferences/${conferenceId}/outreach/new`));
      return;
    }
    setError(err instanceof Error ? err.message : fallback);
  }

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createOutreachCampaign(conferenceId, { name: name.trim(), type });
      setCampaign(created);
      setStep('Upload');
    } catch (err) {
      handleError(err, 'Failed to create campaign');
    } finally {
      setBusy(false);
    }
  }

  async function onUpload() {
    if (!campaign || !file) return;
    setBusy(true);
    setError(null);
    try {
      const parsed = await parseOutreachSpreadsheet(file);
      if (parsed.error) {
        setError(parsed.error);
        return;
      }
      const result = await importOutreachRecipients(conferenceId, campaign.id, parsed.rows);
      setCampaign(result.campaign);
      setImportedCount(result.importedCount);
      setDuplicateCount(result.duplicateCount);
      setInvalidRows(result.invalidRows);
      const list = await fetchOutreachTemplates(conferenceId);
      setTemplates(list);
      const preferred =
        list.find((template) =>
          type === 'TPC_INVITATION'
            ? template.key === 'tpc_invitation'
            : type === 'PAPER_SUBMISSION_INVITATION'
              ? template.key === 'paper_submission_invitation'
              : template.key === 'general_conference_outreach',
        ) ?? list[0];
      setSelectedTemplateId(preferred?.id ?? '');
      setStep('Template');
    } catch (err) {
      handleError(err, 'Failed to import recipients');
    } finally {
      setBusy(false);
    }
  }

  async function onSelectTemplate() {
    if (!campaign || !selectedTemplateId) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await selectOutreachTemplate(conferenceId, campaign.id, selectedTemplateId);
      setCampaign(updated);
      const [previewResult, senderResult] = await Promise.all([
        previewOutreachCampaign(conferenceId, campaign.id),
        fetchOutreachSender(conferenceId),
      ]);
      setPreview(previewResult);
      setSender(senderResult);
      setStep('Preview');
    } catch (err) {
      handleError(err, 'Failed to select template');
    } finally {
      setBusy(false);
    }
  }

  async function onSend() {
    if (!campaign || !confirmed) return;
    setBusy(true);
    setError(null);
    try {
      const result = await sendOutreachCampaign(conferenceId, campaign.id, {
        confirm: true,
        version: campaign.version,
      });
      router.push(`/dashboard/conferences/${conferenceId}/outreach/${result.campaign.id}`);
    } catch (err) {
      handleError(err, 'Failed to send campaign');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionPageLayout
      title="Create outreach campaign"
      description="Create a campaign, upload recipients, choose a template, preview, then confirm send."
      error={error}
      actions={
        <Button variant="outline" asChild>
          <Link href={`/dashboard/conferences/${conferenceId}/outreach`}>Back to campaigns</Link>
        </Button>
      }
    >
      <ol className="mb-6 flex flex-wrap gap-2 text-xs font-medium">
        {STEPS.map((item, index) => {
          const currentIndex = STEPS.indexOf(step);
          const done = index < currentIndex;
          const active = item === step;
          return (
            <li
              key={item}
              className={
                active
                  ? 'rounded-full bg-indigo-600 px-3 py-1 text-white'
                  : done
                    ? 'rounded-full bg-emerald-100 px-3 py-1 text-emerald-700'
                    : 'rounded-full bg-slate-100 px-3 py-1 text-slate-500'
              }
            >
              {index + 1}. {item}
            </li>
          );
        })}
      </ol>

      {step === 'Create' ? (
        <Card>
          <CardHeader>
            <CardTitle>Campaign details</CardTitle>
            <CardDescription>Name the campaign and choose its outreach type.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(event) => void onCreate(event)}>
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Campaign name</Label>
                <Input
                  id="campaign-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaign-type">Campaign type</Label>
                <select
                  id="campaign-type"
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={type}
                  onChange={(event) => setType(event.target.value as OutreachCampaignType)}
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={busy || !name.trim()}>
                Continue
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {step === 'Upload' ? (
        <Card>
          <CardHeader>
            <CardTitle>Upload recipients</CardTitle>
            <CardDescription>
              CSV or Excel with columns name, email, topic, and paper.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SpreadsheetUploadField file={file} onFileChange={setFile} disabled={busy} />
            <Button type="button" disabled={busy || !file} onClick={() => void onUpload()}>
              Validate and continue
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {step === 'Template' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload results</CardTitle>
              <CardDescription>
                {importedCount} valid recipient{importedCount === 1 ? '' : 's'}
                {duplicateCount
                  ? ` · ${duplicateCount} duplicate${duplicateCount === 1 ? '' : 's'}`
                  : ''}
                {invalidRows.length
                  ? ` · ${invalidRows.length} invalid row${invalidRows.length === 1 ? '' : 's'}`
                  : ''}
              </CardDescription>
            </CardHeader>
            {invalidRows.length > 0 ? (
              <CardContent>
                <div className="overflow-x-auto rounded-lg border border-rose-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-rose-50 text-rose-800">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invalidRows.map((row) => (
                        <tr key={`${row.rowNumber}-${row.email ?? ''}`} className="border-t">
                          <td className="px-3 py-2 font-mono text-xs">{row.rowNumber}</td>
                          <td className="px-3 py-2">{row.email ?? '—'}</td>
                          <td className="px-3 py-2 text-rose-700">{row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            ) : null}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Select template</CardTitle>
              <CardDescription>
                Templates can be added later without changing this workflow.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {templates.map((template) => (
                  <label
                    key={template.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50"
                  >
                    <input
                      type="radio"
                      name="template"
                      className="mt-1"
                      checked={selectedTemplateId === template.id}
                      onChange={() => setSelectedTemplateId(template.id)}
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-900">
                        {template.name}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">{template.subject}</span>
                    </span>
                  </label>
                ))}
              </div>
              <Button
                type="button"
                disabled={busy || !selectedTemplateId || importedCount < 1}
                onClick={() => void onSelectTemplate()}
              >
                Preview personalized email
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {step === 'Preview' && preview ? (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              Personalized for {preview.recipientName ?? 'the first recipient'}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Subject</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{preview.subject}</p>
              <div
                className="prose prose-sm mt-4 max-w-none text-slate-800"
                dangerouslySetInnerHTML={{ __html: preview.bodyHtml }}
              />
            </div>
            <Button type="button" onClick={() => setStep('Send')}>
              Continue to confirmation
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {step === 'Send' && campaign && sender ? (
        <Card>
          <CardHeader>
            <CardTitle>Confirm send</CardTitle>
            <CardDescription>{outreachSenderCopy(sender.provider)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Campaign name</dt>
                <dd className="font-medium text-slate-900">{campaign.name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Recipients</dt>
                <dd className="font-medium text-slate-900">{campaign.recipientCount}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Template</dt>
                <dd className="font-medium text-slate-900">{campaign.templateName ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">From</dt>
                <dd className="font-medium text-slate-900">
                  {sender.fromName} &lt;{sender.fromEmail}&gt;
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-500">Reply-To</dt>
                <dd className="font-medium text-slate-900">{sender.replyToEmail}</dd>
              </div>
            </dl>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              I confirm this outreach email should be sent to {campaign.recipientCount} recipient
              {campaign.recipientCount === 1 ? '' : 's'}.
            </label>
            <Button type="button" disabled={busy || !confirmed} onClick={() => void onSend()}>
              Send campaign
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </SectionPageLayout>
  );
}

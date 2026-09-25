'use client';

import type { OutreachCampaignDto, OutreachRecipientDto } from '@openconferences/schemas';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmpty,
  DataTableFooter,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  DataTableSkeleton,
} from '@/components/dashboard/data-table';
import { SectionPageLayout } from '@/components/dashboard/section-page-layout';
import { WorkflowBadge, type WorkflowTone } from '@/components/dashboard/workflow-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  fetchOutreachCampaign,
  fetchOutreachRecipients,
  fetchOutreachSender,
  previewOutreachCampaign,
  sendOutreachCampaign,
} from '@/lib/api-client';
import { isMfaRequiredError, mfaEnrollHref } from '@/lib/mfa-errors';
import { outreachSenderCopy } from '@/lib/outreach-provider';
import type { OutreachPreviewDto, OutreachSenderDto } from '@openconferences/schemas';

const TYPE_LABEL: Record<OutreachCampaignDto['type'], string> = {
  TPC_INVITATION: 'TPC invitation',
  PAPER_SUBMISSION_INVITATION: 'Paper submission invitation',
  GENERAL_OUTREACH: 'General conference outreach',
};

function statusTone(status: string): WorkflowTone {
  if (status === 'SENT') return 'success';
  if (status === 'FAILED' || status === 'BOUNCED' || status === 'COMPLAINED') return 'danger';
  if (status === 'DRAFT') return 'info';
  return 'pending';
}

export default function OutreachCampaignDetailPage() {
  const params = useParams<{ id: string; campaignId: string }>();
  const conferenceId = params.id;
  const campaignId = params.campaignId;
  const router = useRouter();

  const [campaign, setCampaign] = useState<OutreachCampaignDto | null>(null);
  const [recipients, setRecipients] = useState<OutreachRecipientDto[]>([]);
  const [preview, setPreview] = useState<OutreachPreviewDto | null>(null);
  const [sender, setSender] = useState<OutreachSenderDto | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [campaignResult, recipientResult] = await Promise.all([
      fetchOutreachCampaign(conferenceId, campaignId),
      fetchOutreachRecipients(conferenceId, campaignId, { limit: 100 }),
    ]);
    setCampaign(campaignResult);
    setRecipients(recipientResult.data);
    if (campaignResult.templateId && campaignResult.recipientCount > 0) {
      const [previewResult, senderResult] = await Promise.all([
        previewOutreachCampaign(conferenceId, campaignId),
        fetchOutreachSender(conferenceId),
      ]);
      setPreview(previewResult);
      setSender(senderResult);
    }
  }, [campaignId, conferenceId]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [load]);

  async function onSend() {
    if (!campaign || !confirmed) return;
    setBusy(true);
    setError(null);
    try {
      const result = await sendOutreachCampaign(conferenceId, campaign.id, {
        confirm: true,
        version: campaign.version,
      });
      setCampaign(result.campaign);
      setConfirmed(false);
      await load();
    } catch (err) {
      if (isMfaRequiredError(err)) {
        router.push(mfaEnrollHref(`/dashboard/conferences/${conferenceId}/outreach/${campaignId}`));
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setBusy(false);
    }
  }

  const canSend =
    campaign &&
    (campaign.status === 'DRAFT' || campaign.status === 'READY' || campaign.status === 'FAILED') &&
    campaign.recipientCount > 0 &&
    Boolean(campaign.templateId);

  return (
    <SectionPageLayout
      title={campaign?.name ?? 'Outreach campaign'}
      description={campaign ? TYPE_LABEL[campaign.type] : 'Campaign details and sending status.'}
      error={error}
      actions={
        <Button variant="outline" asChild>
          <Link href={`/dashboard/conferences/${conferenceId}/outreach`}>All campaigns</Link>
        </Button>
      }
    >
      {loading || !campaign ? (
        <DataTableSkeleton rows={4} />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Campaign</CardTitle>
              <CardDescription>
                Created {new Date(campaign.createdAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-slate-500">Status</p>
                <WorkflowBadge label={campaign.status} tone={statusTone(campaign.status)} />
              </div>
              <div>
                <p className="text-slate-500">Recipients</p>
                <p className="font-medium">{campaign.recipientCount}</p>
              </div>
              <div>
                <p className="text-slate-500">Template</p>
                <p className="font-medium">{campaign.templateName ?? 'Not selected'}</p>
              </div>
              <div>
                <p className="text-slate-500">Sending status</p>
                <p className="font-medium">
                  {campaign.sentCount} sent · {campaign.failedCount} failed ·{' '}
                  {campaign.skippedCount} skipped
                </p>
              </div>
              {campaign.fromEmail ? (
                <div>
                  <p className="text-slate-500">From</p>
                  <p className="font-medium">
                    {campaign.fromName} &lt;{campaign.fromEmail}&gt;
                  </p>
                </div>
              ) : null}
              {campaign.replyToEmail ? (
                <div>
                  <p className="text-slate-500">Reply-To</p>
                  <p className="font-medium">{campaign.replyToEmail}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {preview ? (
            <Card>
              <CardHeader>
                <CardTitle>Email preview</CardTitle>
                <CardDescription>
                  Personalized for {preview.recipientName ?? 'a sample recipient'}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium text-slate-900">{preview.subject}</p>
                <div
                  className="prose prose-sm mt-3 max-w-none text-slate-800"
                  dangerouslySetInnerHTML={{ __html: preview.bodyHtml }}
                />
              </CardContent>
            </Card>
          ) : null}

          {canSend && sender ? (
            <Card>
              <CardHeader>
                <CardTitle>Send</CardTitle>
                <CardDescription>
                  {outreachSenderCopy(sender.provider)} From {sender.fromName} &lt;
                  {sender.fromEmail}&gt; · Reply-To {sender.replyToEmail}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  I confirm sending this campaign to {campaign.recipientCount} recipient
                  {campaign.recipientCount === 1 ? '' : 's'}.
                </label>
                <Button disabled={busy || !confirmed} onClick={() => void onSend()}>
                  Send campaign
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {recipients.length === 0 ? (
            <DataTableEmpty title="No recipients imported" />
          ) : (
            <DataTable
              footer={
                <DataTableFooter>
                  {recipients.length} recipient{recipients.length === 1 ? '' : 's'}
                </DataTableFooter>
              }
            >
              <DataTableHeader>
                <tr>
                  <DataTableHead>Name</DataTableHead>
                  <DataTableHead>Email</DataTableHead>
                  <DataTableHead>Topic</DataTableHead>
                  <DataTableHead>Status</DataTableHead>
                </tr>
              </DataTableHeader>
              <DataTableBody>
                {recipients.map((recipient) => (
                  <DataTableRow key={recipient.id}>
                    <DataTableCell>{recipient.name}</DataTableCell>
                    <DataTableCell>{recipient.email}</DataTableCell>
                    <DataTableCell className="text-slate-600">{recipient.topic}</DataTableCell>
                    <DataTableCell>
                      <WorkflowBadge label={recipient.status} tone={statusTone(recipient.status)} />
                      {recipient.error ? (
                        <p className="mt-1 text-xs text-rose-600">{recipient.error}</p>
                      ) : null}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </div>
      )}
    </SectionPageLayout>
  );
}

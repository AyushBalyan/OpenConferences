'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
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
import { fetchOutreachCampaigns } from '@/lib/api-client';
import { useCursorList } from '@/hooks/dashboard/use-cursor-list';
import type { OutreachCampaignDto } from '@openconferences/schemas';

const TYPE_LABEL: Record<OutreachCampaignDto['type'], string> = {
  TPC_INVITATION: 'TPC invitation',
  PAPER_SUBMISSION_INVITATION: 'Paper submission invitation',
  GENERAL_OUTREACH: 'General conference outreach',
};

function statusTone(status: OutreachCampaignDto['status']): WorkflowTone {
  if (status === 'SENT') return 'success';
  if (status === 'FAILED') return 'danger';
  if (status === 'DRAFT') return 'info';
  return 'pending';
}

export default function OutreachCampaignsPage() {
  const params = useParams<{ id: string }>();
  const conferenceId = params.id;

  const fetchPage = useCallback(
    async (cursor?: string) => {
      const result = await fetchOutreachCampaigns(
        conferenceId,
        cursor ? { cursor } : { limit: 50 },
      );
      return { data: result.data, nextCursor: result.nextCursor };
    },
    [conferenceId],
  );

  const { items, loading, error, refresh } = useCursorList<OutreachCampaignDto>({ fetchPage });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <SectionPageLayout
      title="Academic outreach"
      description="Send personalized invitations to professors, researchers, and potential authors."
      error={error}
      actions={
        <Button asChild>
          <Link href={`/dashboard/conferences/${conferenceId}/outreach/new`}>Create campaign</Link>
        </Button>
      }
    >
      {loading ? (
        <DataTableSkeleton rows={6} />
      ) : items.length === 0 ? (
        <DataTableEmpty
          title="No outreach campaigns yet"
          description="Create a campaign to invite TPC members or potential authors."
        />
      ) : (
        <DataTable
          footer={
            <DataTableFooter>
              {items.length} campaign{items.length === 1 ? '' : 's'}
            </DataTableFooter>
          }
        >
          <DataTableHeader>
            <tr>
              <DataTableHead>Campaign</DataTableHead>
              <DataTableHead>Type</DataTableHead>
              <DataTableHead>Recipients</DataTableHead>
              <DataTableHead>Status</DataTableHead>
              <DataTableHead>Created</DataTableHead>
              <DataTableHead>Sending</DataTableHead>
            </tr>
          </DataTableHeader>
          <DataTableBody>
            {items.map((campaign) => (
              <DataTableRow key={campaign.id}>
                <DataTableCell>
                  <Link
                    href={`/dashboard/conferences/${conferenceId}/outreach/${campaign.id}`}
                    className="font-medium text-indigo-700 hover:underline"
                  >
                    {campaign.name}
                  </Link>
                </DataTableCell>
                <DataTableCell>{TYPE_LABEL[campaign.type]}</DataTableCell>
                <DataTableCell className="font-mono text-xs text-slate-600">
                  {campaign.recipientCount}
                </DataTableCell>
                <DataTableCell>
                  <WorkflowBadge label={campaign.status} tone={statusTone(campaign.status)} />
                </DataTableCell>
                <DataTableCell className="font-mono text-xs text-slate-500">
                  {new Date(campaign.createdAt).toLocaleString()}
                </DataTableCell>
                <DataTableCell className="text-xs text-slate-500">
                  {campaign.sentCount} sent
                  {campaign.failedCount ? ` · ${campaign.failedCount} failed` : ''}
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}
    </SectionPageLayout>
  );
}

'use client';

import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFooter,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/components/dashboard/data-table';
import { WorkflowBadge, type WorkflowTone } from '@/components/dashboard/workflow-badge';
import {
  BID_OPTIONS,
  bidValueLabel,
  type BidValue,
  type BlindedPaperPoolItemDto,
} from '@/lib/review-types';
import { cn } from '@/lib/utils';

const BID_TONE: Record<BidValue, WorkflowTone> = {
  EAGER: 'success',
  YES: 'info',
  MAYBE: 'pending',
  NO: 'neutral',
  CONFLICT: 'danger',
};

const BID_SORT_ORDER: Record<BidValue, number> = {
  EAGER: 0,
  YES: 1,
  MAYBE: 2,
  NO: 3,
  CONFLICT: 4,
};

type OversightBid = NonNullable<BlindedPaperPoolItemDto['bids']>[number];

type BiddingOversightTableProps = {
  papers: BlindedPaperPoolItemDto[];
};

function countBids(bids: OversightBid[]) {
  const counts = Object.fromEntries(BID_OPTIONS.map((opt) => [opt.value, 0])) as Record<
    BidValue,
    number
  >;
  for (const bid of bids) {
    counts[bid.value] += 1;
  }
  return counts;
}

function sortedBids(bids: OversightBid[]) {
  return [...bids].sort(
    (a, b) =>
      BID_SORT_ORDER[a.value] - BID_SORT_ORDER[b.value] ||
      a.reviewerName.localeCompare(b.reviewerName),
  );
}

function BidSummaryChips({ counts }: { counts: Record<BidValue, number> }) {
  const active = BID_OPTIONS.filter((opt) => counts[opt.value] > 0);
  if (active.length === 0) {
    return <span className="text-sm text-slate-400">No bids yet</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {active.map((opt) => (
        <span
          key={opt.value}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
            BID_TONE[opt.value] === 'success' && 'bg-emerald-100 text-emerald-700',
            BID_TONE[opt.value] === 'info' && 'bg-blue-100 text-blue-700',
            BID_TONE[opt.value] === 'pending' && 'bg-amber-100 text-amber-700',
            BID_TONE[opt.value] === 'neutral' && 'bg-slate-100 text-slate-600',
            BID_TONE[opt.value] === 'danger' && 'bg-rose-100 text-rose-700',
          )}
          title={`${counts[opt.value]} ${opt.label}`}
        >
          <span className="tabular-nums">{counts[opt.value]}</span>
          <span>{opt.label}</span>
        </span>
      ))}
    </div>
  );
}

export function BiddingOversightTable({ papers }: BiddingOversightTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const rows = useMemo(
    () =>
      papers.map((paper) => {
        const bids = paper.bids ?? [];
        return {
          paper,
          bids: sortedBids(bids),
          counts: countBids(bids),
          bidCount: bids.length,
          authors: paper.authorships?.map((a) => a.fullName).join(', ') ?? '—',
        };
      }),
    [papers],
  );

  const totalBids = rows.reduce((sum, row) => sum + row.bidCount, 0);

  function toggleExpanded(paperId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(paperId)) next.delete(paperId);
      else next.add(paperId);
      return next;
    });
  }

  return (
    <DataTable
      footer={
        <DataTableFooter>
          {totalBids} bid{totalBids === 1 ? '' : 's'} across {papers.length} paper
          {papers.length === 1 ? '' : 's'}
        </DataTableFooter>
      }
    >
      <DataTableHeader>
        <tr>
          <DataTableHead className="w-10">
            <span className="sr-only">Expand</span>
          </DataTableHead>
          <DataTableHead>Paper</DataTableHead>
          <DataTableHead>Authors</DataTableHead>
          <DataTableHead className="w-20 text-right">Bids</DataTableHead>
          <DataTableHead>Summary</DataTableHead>
        </tr>
      </DataTableHeader>
      <DataTableBody>
        {rows.map(({ paper, bids, counts, bidCount, authors }) => {
          const expanded = expandedIds.has(paper.id);
          const canExpand = bidCount > 0;

          return (
            <Fragment key={paper.id}>
              <DataTableRow>
                <DataTableCell className="w-10 pr-0">
                  {canExpand ? (
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-label={expanded ? 'Hide reviewer bids' : 'Show reviewer bids'}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      onClick={() => toggleExpanded(paper.id)}
                    >
                      {expanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  ) : (
                    <span className="inline-block h-7 w-7" aria-hidden />
                  )}
                </DataTableCell>
                <DataTableCell>
                  <button
                    type="button"
                    className="text-left"
                    disabled={!canExpand}
                    onClick={() => canExpand && toggleExpanded(paper.id)}
                  >
                    <p className="font-medium text-slate-900">{paper.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{paper.abstract}</p>
                  </button>
                </DataTableCell>
                <DataTableCell className="max-w-[12rem] truncate text-sm text-slate-600">
                  {authors}
                </DataTableCell>
                <DataTableCell className="text-right tabular-nums text-sm text-slate-700">
                  {bidCount}
                </DataTableCell>
                <DataTableCell>
                  <BidSummaryChips counts={counts} />
                </DataTableCell>
              </DataTableRow>

              {expanded && canExpand
                ? bids.map((bid) => (
                    <DataTableRow
                      key={`${paper.id}:${bid.reviewerUserId}`}
                      className="bg-slate-50/80"
                    >
                      <DataTableCell>{null}</DataTableCell>
                      <DataTableCell colSpan={2}>
                        <div className="pl-2">
                          <p className="text-sm font-medium text-slate-800">{bid.reviewerName}</p>
                          <p className="text-xs text-slate-500">{bid.reviewerEmail}</p>
                        </div>
                      </DataTableCell>
                      <DataTableCell>{null}</DataTableCell>
                      <DataTableCell>
                        <WorkflowBadge
                          label={bidValueLabel(bid.value)}
                          tone={BID_TONE[bid.value]}
                        />
                      </DataTableCell>
                    </DataTableRow>
                  ))
                : null}
            </Fragment>
          );
        })}
      </DataTableBody>
    </DataTable>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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
  createAssignment,
  deleteAssignment,
  fetchReviewerInvitations,
  issueReviewerInvitation,
  resendReviewerInvitation,
} from '@/lib/api-client';
import { bidValueLabel, type BidValue, type ReviewerInvitationDto } from '@/lib/review-types';
import { BID_RANK, useAssignmentsWorkspace } from './assignments-workspace';

export function AssignmentsBidsPanel() {
  const {
    bidsByPaper,
    papersWithoutBids,
    assignmentKeys,
    roundId,
    busy,
    prefillAssignment,
    loading,
    conferenceId,
  } = useAssignmentsWorkspace();

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((key) => (
          <Skeleton key={key} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const bidRows = bidsByPaper.flatMap(({ paperId, title, bids }) =>
    bids.map((bid) => ({ ...bid, paperTitle: title, paperId })),
  );

  if (bidRows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-slate-500">
          No reviewer bids yet. Reviewers can bid from the Bidding tab once bidding is open.
        </CardContent>
      </Card>
    );
  }

  const manualBase = `/dashboard/conferences/${conferenceId}/reviews/assignments/manual`;

  return (
    <div className="space-y-3">
      <DataTable
        footer={
          <DataTableFooter>
            {bidRows.length} bid{bidRows.length === 1 ? '' : 's'}
            {papersWithoutBids.length > 0
              ? ` · ${papersWithoutBids.length} paper${papersWithoutBids.length === 1 ? '' : 's'} without bids`
              : ''}
          </DataTableFooter>
        }
      >
        <DataTableHeader>
          <tr>
            <DataTableHead>Paper</DataTableHead>
            <DataTableHead>Reviewer</DataTableHead>
            <DataTableHead>Email</DataTableHead>
            <DataTableHead>Bid</DataTableHead>
            <DataTableHead>Status</DataTableHead>
            <DataTableHead className="text-right">Actions</DataTableHead>
          </tr>
        </DataTableHeader>
        <DataTableBody>
          {bidRows.map((bid) => {
            const assigned = assignmentKeys.has(`${bid.paperId}:${bid.reviewerUserId}`);
            return (
              <DataTableRow key={`${bid.paperId}:${bid.reviewerUserId}`}>
                <DataTableCell>
                  <p className="font-medium text-slate-900">{bid.paperTitle}</p>
                </DataTableCell>
                <DataTableCell>{bid.reviewerName}</DataTableCell>
                <DataTableCell className="text-slate-500">{bid.reviewerEmail}</DataTableCell>
                <DataTableCell>
                  <WorkflowBadge label={bidValueLabel(bid.value)} tone="neutral" />
                </DataTableCell>
                <DataTableCell>
                  {assigned ? (
                    <WorkflowBadge label="Assigned" tone="success" />
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </DataTableCell>
                <DataTableCell className="text-right">
                  {assigned ? null : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy || !roundId || bid.value === 'CONFLICT'}
                      asChild
                    >
                      <Link
                        href={`${manualBase}?paper=${bid.paperId}&reviewer=${bid.reviewerUserId}`}
                        onClick={() => prefillAssignment(bid.paperId, bid.reviewerUserId)}
                      >
                        Assign
                      </Link>
                    </Button>
                  )}
                </DataTableCell>
              </DataTableRow>
            );
          })}
        </DataTableBody>
      </DataTable>
    </div>
  );
}

export function AssignmentsCurrentPanel() {
  const { assignments, busy, setBusy, setError, refresh, conferenceId, loading } =
    useAssignmentsWorkspace();

  async function handleUnassign(assignmentId: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteAssignment(conferenceId, assignmentId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove assignment');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  if (assignments.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-slate-500">
          No assignments yet. Use Reviewer bids or Manual assignment to assign reviewers.
        </CardContent>
      </Card>
    );
  }

  return (
    <DataTable
      footer={
        <DataTableFooter>
          {assignments.length} assignment{assignments.length === 1 ? '' : 's'}
        </DataTableFooter>
      }
    >
      <DataTableHeader>
        <tr>
          <DataTableHead>Paper</DataTableHead>
          <DataTableHead>Reviewer</DataTableHead>
          <DataTableHead>Email</DataTableHead>
          <DataTableHead>Bid</DataTableHead>
          <DataTableHead className="text-right">Actions</DataTableHead>
        </tr>
      </DataTableHeader>
      <DataTableBody>
        {assignments.map((assignment) => (
          <DataTableRow key={assignment.id}>
            <DataTableCell>
              <p className="font-medium text-slate-900">
                {assignment.paperTitle ?? assignment.paperId}
              </p>
            </DataTableCell>
            <DataTableCell>{assignment.reviewerName ?? assignment.reviewerUserId}</DataTableCell>
            <DataTableCell className="text-slate-500">
              {assignment.reviewerEmail ?? '—'}
            </DataTableCell>
            <DataTableCell>
              {assignment.bidValue ? (
                <WorkflowBadge
                  label={bidValueLabel(assignment.bidValue as BidValue)}
                  tone="neutral"
                />
              ) : (
                <span className="text-sm text-slate-400">—</span>
              )}
            </DataTableCell>
            <DataTableCell className="text-right">
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void handleUnassign(assignment.id)}
              >
                Remove
              </Button>
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTableBody>
    </DataTable>
  );
}

function invitationStatusTone(status: ReviewerInvitationDto['status']): WorkflowTone {
  switch (status) {
    case 'PENDING':
      return 'pending';
    case 'ACCEPTED':
      return 'success';
    case 'DECLINED':
      return 'danger';
    case 'EXPIRED':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function formatInvitationExpiry(expiresAt: string): string {
  return new Date(expiresAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function AssignmentsInvitesPanel() {
  const { conferenceId, busy, setBusy, setError, setMessage } = useAssignmentsWorkspace();
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitations, setInvitations] = useState<ReviewerInvitationDto[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const loadInvitations = async () => {
    setLoadingInvitations(true);
    try {
      const data = await fetchReviewerInvitations(conferenceId);
      setInvitations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invitations');
    } finally {
      setLoadingInvitations(false);
    }
  };

  useEffect(() => {
    void loadInvitations();
  }, [conferenceId]);

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await issueReviewerInvitation(conferenceId, { email: inviteEmail.trim() });
      setMessage(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      await loadInvitations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setBusy(false);
    }
  }

  async function handleResend(invitationId: string, email: string) {
    setResendingId(invitationId);
    setError(null);
    setMessage(null);
    try {
      const result = await resendReviewerInvitation(conferenceId, invitationId);
      setMessage(result.message ?? `Invitation resent to ${email}`);
      await loadInvitations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend invitation');
    } finally {
      setResendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite reviewer</CardTitle>
          <CardDescription>
            Send a token-based email invitation to join as a reviewer.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="reviewer@university.edu"
            />
          </div>
          <Button onClick={() => void handleInvite()} disabled={busy}>
            Send invitation
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sent invitations</CardTitle>
          <CardDescription>
            Resend the invitation email if a reviewer did not receive it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingInvitations ? (
            <Skeleton className="h-24 w-full" />
          ) : invitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviewer invitations yet.</p>
          ) : (
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Email</DataTableHead>
                  <DataTableHead>Status</DataTableHead>
                  <DataTableHead>Expires</DataTableHead>
                  <DataTableHead className="text-right">Actions</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {invitations.map((invitation) => {
                  const canResend =
                    invitation.status === 'PENDING' || invitation.status === 'EXPIRED';

                  return (
                    <DataTableRow key={invitation.id}>
                      <DataTableCell>{invitation.email}</DataTableCell>
                      <DataTableCell>
                        <WorkflowBadge
                          label={invitation.status}
                          tone={invitationStatusTone(invitation.status)}
                        />
                      </DataTableCell>
                      <DataTableCell className="text-muted-foreground">
                        {formatInvitationExpiry(invitation.expiresAt)}
                      </DataTableCell>
                      <DataTableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canResend || resendingId === invitation.id}
                          onClick={() => void handleResend(invitation.id, invitation.email)}
                        >
                          {resendingId === invitation.id ? 'Sending…' : 'Resend email'}
                        </Button>
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function AssignmentsManualPanel() {
  const searchParams = useSearchParams();
  const {
    conferenceId,
    roundId,
    papers,
    reviewers,
    selectedPaper,
    setSelectedPaper,
    selectedReviewer,
    setSelectedReviewer,
    bidForReviewer,
    busy,
    setBusy,
    setError,
    setMessage,
    refresh,
  } = useAssignmentsWorkspace();

  useEffect(() => {
    const paper = searchParams.get('paper');
    const reviewer = searchParams.get('reviewer');
    if (paper) setSelectedPaper(paper);
    if (reviewer) setSelectedReviewer(reviewer);
  }, [searchParams, setSelectedPaper, setSelectedReviewer]);

  async function handleAssign() {
    if (!roundId || !selectedPaper || !selectedReviewer) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await createAssignment(conferenceId, selectedPaper, {
        roundId,
        reviewerUserId: selectedReviewer,
      });
      setMessage(result.message);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Manual assignment</CardTitle>
        <CardDescription>Assign a reviewer to a paper (COI-checked server-side).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="paper">Paper</Label>
            <select
              id="paper"
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              value={selectedPaper}
              onChange={(e) => setSelectedPaper(e.target.value)}
            >
              <option value="">Select paper…</option>
              {papers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reviewer">Reviewer</Label>
            <select
              id="reviewer"
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              value={selectedReviewer}
              onChange={(e) => setSelectedReviewer(e.target.value)}
            >
              <option value="">Select reviewer…</option>
              {[...reviewers]
                .sort((a, b) => {
                  if (!selectedPaper) return a.name.localeCompare(b.name);
                  const aBid = bidForReviewer(selectedPaper, a.userId);
                  const bBid = bidForReviewer(selectedPaper, b.userId);
                  if (aBid && bBid) return BID_RANK[aBid] - BID_RANK[bBid];
                  if (aBid) return -1;
                  if (bBid) return 1;
                  return a.name.localeCompare(b.name);
                })
                .map((r) => {
                  const bid = selectedPaper ? bidForReviewer(selectedPaper, r.userId) : undefined;
                  return (
                    <option key={r.userId} value={r.userId}>
                      {r.name} ({r.email}){bid ? ` — ${bidValueLabel(bid)}` : ''}
                    </option>
                  );
                })}
            </select>
          </div>
        </div>
        <Button onClick={() => void handleAssign()} disabled={busy || !roundId}>
          Assign reviewer
        </Button>
      </CardContent>
    </Card>
  );
}

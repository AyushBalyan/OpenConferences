'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/components/dashboard/data-table';
import { WorkflowBadge, type WorkflowTone } from '@/components/dashboard/workflow-badge';
import {
  fetchReviewerInvitations,
  fetchReviewerInvitationLink,
  issueReviewerInvitation,
  resendReviewerInvitation,
  revokeReviewerInvitation,
} from '@/lib/api-client';
import type { ReviewerInvitationDto } from '@/lib/review-types';
import { useAssignmentsWorkspace } from './assignments-workspace';

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
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [linkId, setLinkId] = useState<string | null>(null);
  const [issuingDelivery, setIssuingDelivery] = useState<'EMAIL' | 'LINK_ONLY' | null>(null);
  const [shareLink, setShareLink] = useState<{
    id: string;
    email: string;
    invitationUrl: string;
    expiresAt: string;
  } | null>(null);
  const actionPending = busy || !!resendingId || !!revokingId || !!linkId;

  const loadInvitations = useCallback(async () => {
    setLoadingInvitations(true);
    try {
      const data = await fetchReviewerInvitations(conferenceId);
      setInvitations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invitations');
    } finally {
      setLoadingInvitations(false);
    }
  }, [conferenceId, setError]);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  async function handleInvite(delivery: 'EMAIL' | 'LINK_ONLY') {
    if (!inviteEmail.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    setShareLink(null);
    setIssuingDelivery(delivery);
    try {
      const invitation = await issueReviewerInvitation(conferenceId, {
        email: inviteEmail.trim(),
        delivery,
      });
      if (delivery === 'LINK_ONLY') {
        setShareLink(invitation);
        setMessage(`Invitation created for ${invitation.email}. No email was sent.`);
      } else {
        setMessage(`Invitation email sent to ${invitation.email}`);
      }
      setInviteEmail('');
      await loadInvitations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invitation');
    } finally {
      setBusy(false);
      setIssuingDelivery(null);
    }
  }

  async function copyLink(invitationUrl: string) {
    setError(null);
    setMessage(null);
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setMessage('Invitation link copied.');
    } catch {
      setError('Could not copy the link. Select and copy it from the field below.');
    }
  }

  async function handleCopyLink(invitationId: string) {
    setLinkId(invitationId);
    setError(null);
    setMessage(null);
    setShareLink(null);
    try {
      const link = await fetchReviewerInvitationLink(conferenceId, invitationId);
      setShareLink({ ...link, id: invitationId });
      await copyLink(link.invitationUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invitation link');
    } finally {
      setLinkId(null);
    }
  }

  async function handleResend(invitationId: string, email: string) {
    setResendingId(invitationId);
    setError(null);
    setMessage(null);
    try {
      const result = await resendReviewerInvitation(conferenceId, invitationId);
      setMessage(`Invitation email sent to ${email}`);
      setShareLink((current) =>
        current?.id === invitationId
          ? { ...current, expiresAt: result.invitation.expiresAt }
          : current,
      );
      await loadInvitations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend invitation');
    } finally {
      setResendingId(null);
    }
  }

  async function handleRevoke(invitationId: string, email: string) {
    setRevokingId(invitationId);
    setError(null);
    setMessage(null);
    try {
      await revokeReviewerInvitation(conferenceId, invitationId);
      if (shareLink?.id === invitationId) setShareLink(null);
      setMessage(`Removed pending invitation for ${email}`);
      await loadInvitations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove invitation');
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite reviewer</CardTitle>
          <CardDescription>
            Send an invitation email or generate a link to share yourself. Both create a pending
            invitation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-col gap-3 lg:flex-row lg:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              const submitter = (event.nativeEvent as SubmitEvent)
                .submitter as HTMLButtonElement | null;
              void handleInvite(submitter?.value === 'LINK_ONLY' ? 'LINK_ONLY' : 'EMAIL');
            }}
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                required
                disabled={actionPending}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="reviewer@university.edu"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" value="EMAIL" disabled={actionPending}>
                {issuingDelivery === 'EMAIL' ? 'Sending…' : 'Send invitation email'}
              </Button>
              <Button type="submit" value="LINK_ONLY" variant="outline" disabled={actionPending}>
                {issuingDelivery === 'LINK_ONLY' ? 'Generating…' : 'Generate link'}
              </Button>
            </div>
          </form>
          {shareLink ? (
            <div className="space-y-2">
              <Label htmlFor="reviewer-invitation-link">
                Invitation link for {shareLink.email}
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="reviewer-invitation-link"
                  readOnly
                  value={shareLink.invitationUrl}
                  onFocus={(event) => event.target.select()}
                  className="min-w-0 flex-1"
                />
                <Button variant="outline" onClick={() => void copyLink(shareLink.invitationUrl)}>
                  Copy link
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Expires {formatInvitationExpiry(shareLink.expiresAt)}. The reviewer must sign in
                with the invited email address.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reviewer invitations</CardTitle>
          <CardDescription>
            Copy a pending invitation link, send an email, or remove a pending invitation.
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
                  const canRevoke = invitation.status === 'PENDING';
                  const canCopy =
                    invitation.status === 'PENDING' && new Date(invitation.expiresAt) > new Date();

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
                        <div className="inline-flex flex-wrap items-center justify-end gap-2">
                          {canCopy ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={actionPending}
                              onClick={() => void handleCopyLink(invitation.id)}
                            >
                              {linkId === invitation.id ? 'Loading…' : 'Copy link'}
                            </Button>
                          ) : null}
                          {canRevoke ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={actionPending}
                              onClick={() => void handleRevoke(invitation.id, invitation.email)}
                            >
                              {revokingId === invitation.id ? 'Removing…' : 'Remove'}
                            </Button>
                          ) : null}
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!canResend || actionPending}
                            onClick={() => void handleResend(invitation.id, invitation.email)}
                          >
                            {resendingId === invitation.id ? 'Sending…' : 'Send email'}
                          </Button>
                        </div>
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

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
  fetchConference,
  updateConferenceSettings,
  operateReviewerInvitation,
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
  const [lifetimeDays, setLifetimeDays] = useState(7);
  const [filter, setFilter] = useState('');
  const [operation, setOperation] = useState<{
    invitation: ReviewerInvitationDto;
    action: 'EXTEND' | 'REISSUE' | 'REINVITE';
  } | null>(null);
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
    declineUrl?: string;
    expiresAt: string;
  } | null>(null);
  const actionPending = busy || !!resendingId || !!revokingId || !!linkId;

  const loadInvitations = useCallback(async () => {
    setLoadingInvitations(true);
    try {
      const data = await fetchReviewerInvitations(conferenceId, true);
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

  useEffect(() => {
    let active = true;
    void fetchConference(conferenceId)
      .then((conference) => {
        if (active) setLifetimeDays(conference.invitationLifetimeDays ?? 7);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [conferenceId]);

  async function saveDefaultLifetime() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await updateConferenceSettings(conferenceId, { invitationLifetimeDays: lifetimeDays });
      setMessage(
        `Conference invitations now default to ${lifetimeDays} days. Existing invitations keep their expiry.`,
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save invitation default');
    } finally {
      setBusy(false);
    }
  }

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
        lifetimeDays,
      });
      if (delivery === 'LINK_ONLY') {
        setShareLink(invitation);
        setMessage(`Invitation marked Sent for ${invitation.email}. Links are ready to share.`);
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
      await loadInvitations();
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
      setMessage(`Invitation revoked for ${email}. Its links no longer work.`);
      await loadInvitations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove invitation');
    } finally {
      setRevokingId(null);
    }
  }

  async function applyOperation() {
    if (!operation) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await operateReviewerInvitation(conferenceId, operation.invitation.id, {
        action: operation.action,
        version: operation.invitation.version ?? 0,
        lifetimeDays,
      });
      setShareLink(
        result.invitationUrl
          ? {
              id: result.invitation.id,
              email: result.invitation.email,
              invitationUrl: result.invitationUrl,
              declineUrl: result.declineUrl,
              expiresAt: result.invitation.expiresAt,
            }
          : null,
      );
      setMessage(
        operation.action === 'EXTEND'
          ? 'Expiry extended. Current links still work.'
          : 'New links generated and marked Sent. Share the new links with the reviewer.',
      );
      setOperation(null);
      await loadInvitations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update invitation');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite reviewer</CardTitle>
          <CardDescription>
            Generate personal links to share from your conference mailbox, or send an email through
            the platform. Generating links marks the invitation Sent.
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
            <div className="space-y-2">
              <Label htmlFor="invite-lifetime">Valid for (days)</Label>
              <Input
                id="invite-lifetime"
                type="number"
                min={1}
                max={30}
                required
                className="w-28"
                value={lifetimeDays}
                onChange={(e) => setLifetimeDays(Number(e.target.value))}
                disabled={actionPending}
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
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>Choose 1–30 days. Changing this value affects this invitation.</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={
                actionPending ||
                !Number.isInteger(lifetimeDays) ||
                lifetimeDays < 1 ||
                lifetimeDays > 30
              }
              onClick={() => void saveDefaultLifetime()}
            >
              Set as conference default
            </Button>
          </div>
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
              {shareLink.declineUrl ? (
                <div className="space-y-2">
                  <Label htmlFor="reviewer-decline-link">Decline link — no sign-in needed</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="reviewer-decline-link"
                      readOnly
                      value={shareLink.declineUrl}
                      onFocus={(e) => e.target.select()}
                      className="min-w-0 flex-1"
                    />
                    <Button variant="outline" onClick={() => void copyLink(shareLink.declineUrl!)}>
                      Copy decline link
                    </Button>
                  </div>
                </div>
              ) : null}
              <p className="text-sm text-muted-foreground">
                Expires {formatInvitationExpiry(shareLink.expiresAt)}. The reviewer must sign in
                with the invited email address.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {operation ? (
        <section aria-label="Update invitation" className="space-y-4 rounded-lg border p-5">
          <h3 className="font-semibold">
            {operation?.action === 'EXTEND'
              ? 'Extend invitation'
              : operation?.action === 'REINVITE'
                ? 'Send a new invitation'
                : 'Reissue invitation links'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {operation?.invitation.email}.{' '}
            {operation?.action === 'EXTEND'
              ? 'Current links stay valid. Choose an expiry later than the current expiry.'
              : operation?.action === 'REINVITE'
                ? 'Creates a new invitation and preserves the previous response.'
                : 'Both old links will stop working. Share the replacement links with the reviewer.'}{' '}
            No email is sent by this action.
          </p>
          <div className="space-y-2">
            <Label htmlFor="operation-lifetime">Days from today (1–30)</Label>
            <Input
              id="operation-lifetime"
              type="number"
              min={1}
              max={30}
              value={lifetimeDays}
              onChange={(e) => setLifetimeDays(Number(e.target.value))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setOperation(null)}>
              Cancel
            </Button>
            <Button
              disabled={
                busy || lifetimeDays < 1 || lifetimeDays > 30 || !Number.isInteger(lifetimeDays)
              }
              onClick={() => void applyOperation()}
            >
              {busy ? 'Updating…' : 'Confirm update'}
            </Button>
          </div>
        </section>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reviewer invitations</CardTitle>
          <CardDescription>
            Extend expiry without changing links, reissue links, or revoke access. Sent records link
            generation; it does not confirm mailbox delivery.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 max-w-sm space-y-2">
            <Label htmlFor="filter-invitations">Find invitation</Label>
            <Input
              id="filter-invitations"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by email or status"
            />
          </div>
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
                {invitations
                  .filter((invitation) =>
                    `${invitation.email} ${invitation.lifecycleStatus ?? invitation.status}`
                      .toLowerCase()
                      .includes(filter.toLowerCase()),
                  )
                  .map((invitation) => {
                    const canResend =
                      !invitation.revokedAt &&
                      (invitation.status === 'PENDING' || invitation.status === 'EXPIRED');
                    const canRevoke = invitation.status === 'PENDING';
                    const canCopy =
                      invitation.status === 'PENDING' &&
                      new Date(invitation.expiresAt) > new Date();

                    return (
                      <DataTableRow key={invitation.id}>
                        <DataTableCell>{invitation.email}</DataTableCell>
                        <DataTableCell>
                          <WorkflowBadge
                            label={invitation.lifecycleStatus ?? invitation.status}
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
                            {['PENDING', 'EXPIRED', 'DECLINED'].includes(invitation.status) ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={actionPending}
                                onClick={() =>
                                  setOperation({
                                    invitation,
                                    action:
                                      invitation.status === 'DECLINED' || invitation.revokedAt
                                        ? 'REINVITE'
                                        : 'REISSUE',
                                  })
                                }
                              >
                                {invitation.status === 'DECLINED' || invitation.revokedAt
                                  ? 'Reinvite'
                                  : 'Reissue'}
                              </Button>
                            ) : null}
                            {canCopy ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={actionPending}
                                onClick={() => setOperation({ invitation, action: 'EXTEND' })}
                              >
                                Extend
                              </Button>
                            ) : null}
                            {canRevoke ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={actionPending}
                                onClick={() => void handleRevoke(invitation.id, invitation.email)}
                              >
                                {revokingId === invitation.id ? 'Revoking…' : 'Revoke'}
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

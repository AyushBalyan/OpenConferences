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

  async function handleRevoke(invitationId: string, email: string) {
    setRevokingId(invitationId);
    setError(null);
    setMessage(null);
    try {
      await revokeReviewerInvitation(conferenceId, invitationId);
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
            Resend the invitation email or remove invitations that are still pending.
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
                  const actionBusy = resendingId === invitation.id || revokingId === invitation.id;

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
                        <div className="inline-flex items-center justify-end gap-2">
                          {canRevoke ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={actionBusy}
                              onClick={() => void handleRevoke(invitation.id, invitation.email)}
                            >
                              {revokingId === invitation.id ? 'Removing…' : 'Remove'}
                            </Button>
                          ) : null}
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!canResend || actionBusy}
                            onClick={() => void handleResend(invitation.id, invitation.email)}
                          >
                            {resendingId === invitation.id ? 'Sending…' : 'Resend email'}
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

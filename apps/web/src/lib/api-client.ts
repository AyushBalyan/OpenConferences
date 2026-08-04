import { initClient } from '@ts-rest/core';
import { apiContract } from '@openconferences/contracts';
import { MFA_REQUIRED_DETAIL, MfaRequiredError } from '@/lib/mfa-errors';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export type PaginatedResult<T> = {
  data: T[];
  nextCursor: string | null;
};

export const apiClient = initClient(apiContract, {
  baseUrl,
  baseHeaders: {},
  credentials: 'include',
});

export async function fetchHealthz() {
  const result = await apiClient.health.healthz();
  if (result.status === 200) {
    return result.body;
  }
  throw new Error(`Health check failed with status ${result.status}`);
}

export async function fetchMe() {
  const result = await apiClient.auth.me();
  if (result.status === 200) {
    return result.body;
  }
  return null;
}

export async function setupAccount(body: {
  name: string;
  password: string;
  confirmPassword: string;
}) {
  const result = await apiClient.auth.setupAccount({ body });
  if (result.status === 200) {
    return result.body;
  }
  if (result.status === 409) {
    throw new Error(result.body.detail ?? 'Account already has a password');
  }
  if (result.status === 400) {
    throw new Error(result.body.detail ?? 'Invalid account setup request');
  }
  throw new Error('Failed to set up account');
}

export async function fetchMeDashboard() {
  const result = await apiClient.auth.dashboard();
  if (result.status === 200) return result.body;
  throw new Error('Failed to load dashboard');
}

export async function fetchAnalyticsOverview(conferenceId: string) {
  const result = await apiClient.analytics.getOverview({ params: { conferenceId } });
  if (result.status === 200) return result.body;
  if (result.status === 403) throw new Error(result.body.detail ?? 'Forbidden');
  if (result.status === 404) throw new Error('Conference not found');
  throw new Error('Failed to load analytics');
}

export async function fetchOrganizations() {
  const result = await apiClient.organizations.list({ query: {} });
  if (result.status === 200) return result.body.data;
  throw new Error('Failed to load organizations');
}

export async function fetchConferences(organizationId?: string) {
  const result = await apiClient.conferences.list({
    query: organizationId ? { organizationId } : {},
  });
  if (result.status === 200) return result.body;
  throw new Error('Failed to load conferences');
}

export async function fetchConference(id: string) {
  const result = await apiClient.conferences.get({ params: { id } });
  if (result.status === 200) return result.body;
  if (result.status === 404) throw new Error('Conference not found');
  throw new Error('Failed to load conference');
}

export async function createConference(body: {
  organizationId: string;
  slug: string;
  name: string;
  blindingMode?: 'SINGLE' | 'DOUBLE' | 'OPEN';
}) {
  const result = await apiClient.conferences.create({ body });
  if (result.status === 201) return result.body;
  if (result.status === 403) {
    const detail = result.body.detail ?? 'Forbidden';
    if (detail.includes(MFA_REQUIRED_DETAIL)) {
      throw new MfaRequiredError(detail);
    }
    throw new Error(detail);
  }
  if (result.status === 409) throw new Error(result.body.detail ?? 'Conflict');
  throw new Error('Failed to create conference');
}

export async function joinAsAuthor(token: string) {
  const result = await apiClient.conferences.joinAsAuthor({ body: { token } });
  if (result.status === 200) return result.body;
  if (result.status === 403) throw new Error(result.body.detail ?? 'Forbidden');
  if (result.status === 404) throw new Error(result.body.detail ?? 'Invalid submit link');
  if (result.status === 409) throw new Error(result.body.detail ?? 'Submissions are not open');
  throw new Error('Failed to join as author');
}

export async function fetchAuthorJoinLink(conferenceId: string) {
  const result = await apiClient.conferences.getAuthorJoinLink({ params: { id: conferenceId } });
  if (result.status === 200) return result.body;
  if (result.status === 403) throw new Error(result.body.detail ?? 'Forbidden');
  if (result.status === 404) throw new Error('Conference not found');
  throw new Error('Failed to load submit link');
}

export async function rotateAuthorJoinLink(conferenceId: string) {
  const result = await apiClient.conferences.rotateAuthorJoinLink({ params: { id: conferenceId } });
  if (result.status === 200) return result.body;
  if (result.status === 403) throw new Error(result.body.detail ?? 'Forbidden');
  if (result.status === 404) throw new Error('Conference not found');
  throw new Error('Failed to rotate submit link');
}

export async function updateConferenceSettings(id: string, body: Record<string, unknown>) {
  const result = await apiClient.conferences.updateSettings({ params: { id }, body });
  if (result.status === 200) return result.body;
  if (
    'body' in result &&
    result.body &&
    typeof result.body === 'object' &&
    'detail' in result.body
  ) {
    throw new Error(
      String((result.body as { detail?: string }).detail ?? 'Failed to update settings'),
    );
  }
  throw new Error('Failed to update settings');
}

export async function fetchTracks(conferenceId: string) {
  const result = await apiClient.conferences.listTracks({ params: { id: conferenceId } });
  if (result.status === 200) return result.body.data;
  throw new Error('Failed to load tracks');
}

export async function createTrack(
  conferenceId: string,
  body: { slug: string; name: string; description?: string },
) {
  const result = await apiClient.conferences.createTrack({
    params: { id: conferenceId },
    body,
  });
  if (result.status === 201) return result.body;
  throw new Error('Failed to create track');
}

export async function fetchMembers(conferenceId: string) {
  const result = await apiClient.conferences.listMembers({ params: { id: conferenceId } });
  if (result.status === 200) return result.body.data;
  throw new Error('Failed to load members');
}

export async function grantRole(
  conferenceId: string,
  body: {
    userId: string;
    role: 'AUTHOR' | 'REVIEWER' | 'CHAIR' | 'ORGANIZER' | 'ORG_ADMIN';
    scope: 'CONFERENCE' | 'ORGANIZATION';
  },
) {
  const result = await apiClient.conferences.grantRole({
    params: { id: conferenceId },
    body,
  });
  if (result.status === 201) return result.body.data;
  if (result.status === 403) throw new Error(result.body.detail ?? 'Forbidden');
  throw new Error('Failed to grant role');
}

export async function revokeRole(
  conferenceId: string,
  body: {
    userId: string;
    role: 'AUTHOR' | 'REVIEWER' | 'CHAIR' | 'ORGANIZER' | 'ORG_ADMIN';
    scope: 'CONFERENCE' | 'ORGANIZATION';
  },
) {
  const result = await apiClient.conferences.revokeRole({
    params: { id: conferenceId },
    body,
  });
  if (result.status === 200) return result.body.data;
  if (result.status === 403) throw new Error(result.body.detail ?? 'Forbidden');
  if (result.status === 404) throw new Error(result.body.detail ?? 'Not found');
  throw new Error('Failed to revoke role');
}

export async function fetchAuditLogs(
  conferenceId: string,
  query?: { cursor?: string; limit?: number },
) {
  const result = await apiClient.conferences.listAuditLogs({
    params: { id: conferenceId },
    query: query ?? {},
  });
  if (result.status === 200) return result.body;
  throw new Error('Failed to load audit logs');
}

export async function fetchNotificationLogs(
  conferenceId: string,
  query?: {
    status?: 'QUEUED' | 'SENT' | 'FAILED' | 'BOUNCED';
    templateKey?: string;
    search?: string;
  },
) {
  const result = await apiClient.messaging.listNotificationLogs({
    params: { id: conferenceId },
    query: query ?? {},
  });
  if (result.status === 200) return result.body;
  throw new Error('Failed to load notification logs');
}

export async function resendNotification(conferenceId: string, logId: string) {
  const result = await apiClient.messaging.resendNotification({
    params: { id: conferenceId, logId },
  });
  if (result.status === 200) return result.body;
  throw new Error('Failed to resend notification');
}

export async function fetchNotificationTemplates(conferenceId: string) {
  const result = await apiClient.messaging.listNotificationTemplates({
    params: { id: conferenceId },
    query: {},
  });
  if (result.status === 200) return result.body.data;
  throw new Error('Failed to load notification templates');
}

export async function createNotificationTemplate(
  conferenceId: string,
  body: {
    key: string;
    subject: string;
    bodyHtml: string;
    bodyText?: string;
    variables?: string[];
    locale?: string;
    isActive?: boolean;
  },
) {
  const result = await apiClient.messaging.createNotificationTemplate({
    params: { id: conferenceId },
    body,
  });
  if (result.status === 201) return result.body;
  throw new Error('Failed to create notification template');
}

export async function updateNotificationTemplate(
  conferenceId: string,
  templateId: string,
  body: {
    subject?: string;
    bodyHtml?: string;
    bodyText?: string | null;
    variables?: string[];
    isActive?: boolean;
  },
) {
  const result = await apiClient.messaging.updateNotificationTemplate({
    params: { id: conferenceId, templateId },
    body,
  });
  if (result.status === 200) return result.body;
  throw new Error('Failed to update notification template');
}

export async function transitionConferenceStatus(
  id: string,
  status:
    'DRAFT' | 'CFP_OPEN' | 'REVIEWING' | 'DECISIONS' | 'FINALIZATION' | 'COMPLETED' | 'ARCHIVED',
) {
  const result = await apiClient.conferences.transitionStatus({
    params: { id },
    body: { status },
  });
  if (result.status === 200) return result.body;
  if (result.status === 409) throw new Error(result.body.detail ?? 'Invalid transition');
  throw new Error('Failed to transition status');
}

export async function fetchPapers(
  conferenceId: string,
  query?: {
    mine?: boolean;
    cursor?: string;
    limit?: number;
    status?: import('@openconferences/schemas').PaperDto['status'];
    trackId?: string;
    q?: string;
  },
) {
  const result = await apiClient.submission.listPapers({
    params: { conferenceId },
    query: query ?? {},
  });
  if (result.status === 200) return result.body;
  throw new Error('Failed to load submissions');
}

export async function fetchPaper(conferenceId: string, paperId: string) {
  const result = await apiClient.submission.getPaper({
    params: { conferenceId, paperId },
  });
  if (result.status === 200) return result.body;
  if (result.status === 404) throw new Error('Submission not found');
  throw new Error('Failed to load submission');
}

export async function createPaper(
  conferenceId: string,
  body: {
    trackId?: string;
    title: string;
    abstract: string;
    keywords: string[];
    correspondingAffiliation?: string;
  },
) {
  const result = await apiClient.submission.createPaper({ params: { conferenceId }, body });
  if (result.status === 201) return result.body;
  if (result.status === 409) throw new Error(result.body.detail ?? 'Cannot create submission');
  throw new Error('Failed to create submission');
}

export async function updatePaper(
  conferenceId: string,
  paperId: string,
  body: {
    trackId?: string;
    title?: string;
    abstract?: string;
    keywords?: string[];
    version: number;
  },
) {
  const result = await apiClient.submission.updatePaper({
    params: { conferenceId, paperId },
    body,
  });
  if (result.status === 200) return result.body;
  if (result.status === 409) throw new Error(result.body.detail ?? 'Conflict');
  throw new Error('Failed to update submission');
}

export async function addAuthorship(
  conferenceId: string,
  paperId: string,
  body: {
    fullName: string;
    email: string;
    affiliation?: string;
    isCorresponding?: boolean;
    userId?: string | null;
  },
) {
  const result = await apiClient.submission.addAuthorship({
    params: { conferenceId, paperId },
    body,
  });
  if (result.status === 201) return result.body;
  throw new Error('Failed to add author');
}

export async function initiateVersionUpload(
  conferenceId: string,
  paperId: string,
  body: {
    originalFilename: string;
    contentType: 'application/pdf';
    sizeBytes: number;
    kind?: 'SUBMISSION' | 'REVISION' | 'CAMERA_READY' | 'SUPPLEMENTARY';
  },
) {
  const result = await apiClient.submission.initiateVersion({
    params: { conferenceId, paperId },
    body,
  });
  if (result.status === 200) return result.body;
  if (result.status === 400) throw new Error(result.body.detail ?? 'Invalid upload');
  throw new Error('Failed to initiate upload');
}

export async function completeVersionUpload(
  conferenceId: string,
  paperId: string,
  body: { objectKey: string; kind?: 'SUBMISSION' | 'REVISION' | 'CAMERA_READY' | 'SUPPLEMENTARY' },
) {
  const result = await apiClient.submission.completeVersion({
    params: { conferenceId, paperId },
    body,
  });
  if (result.status === 201) return result.body;
  if (result.status === 400) throw new Error(result.body.detail ?? 'Upload finalize failed');
  throw new Error('Failed to complete upload');
}

export async function submitPaper(conferenceId: string, paperId: string) {
  const result = await apiClient.submission.submitPaper({
    params: { conferenceId, paperId },
  });
  if (result.status === 200) return result.body;
  if (result.status === 409) throw new Error(result.body.detail ?? 'Cannot submit');
  throw new Error('Failed to submit paper');
}

export async function downloadPaperVersion(
  conferenceId: string,
  paperId: string,
  versionId: string,
) {
  const result = await apiClient.submission.downloadVersion({
    params: { conferenceId, paperId, versionId },
  });
  if (result.status === 200) return result.body;
  if (result.status === 403) throw new Error(result.body.detail ?? 'Download not available');
  if (result.status === 404) throw new Error('Paper version not found');
  throw new Error('Failed to download paper');
}

export async function uploadPaperPdf(
  conferenceId: string,
  paperId: string,
  file: File,
): Promise<void> {
  const presigned = await initiateVersionUpload(conferenceId, paperId, {
    originalFilename: file.name,
    contentType: 'application/pdf',
    sizeBytes: file.size,
    kind: 'SUBMISSION',
  });

  const putResponse = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: file,
  });

  if (!putResponse.ok) {
    throw new Error('Direct upload to storage failed');
  }

  await completeVersionUpload(conferenceId, paperId, {
    objectKey: presigned.objectKey,
    kind: 'SUBMISSION',
  });
}

export async function uploadCameraReadyPdf(
  conferenceId: string,
  paperId: string,
  file: File,
): Promise<void> {
  const presigned = await initiateVersionUpload(conferenceId, paperId, {
    originalFilename: file.name,
    contentType: 'application/pdf',
    sizeBytes: file.size,
    kind: 'CAMERA_READY',
  });

  const putResponse = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: file,
  });

  if (!putResponse.ok) {
    throw new Error('Direct upload to storage failed');
  }

  await completeVersionUpload(conferenceId, paperId, {
    objectKey: presigned.objectKey,
    kind: 'CAMERA_READY',
  });
}

// --- Review (Phase 4) ---

export async function fetchReviewRounds(conferenceId: string) {
  const result = await apiClient.review.listRounds({ params: { conferenceId } });
  if (result.status === 200) return result.body.data;
  throw new Error('Failed to load review rounds');
}

export async function createReviewRound(
  conferenceId: string,
  body: { roundNumber?: number; reviewDueAt?: string },
) {
  const result = await apiClient.review.createRound({ params: { conferenceId }, body });
  if (result.status === 201) return result.body;
  if (result.status === 409) throw new Error(result.body.detail ?? 'Round already exists');
  if (result.status === 403)
    throw new Error(result.body.detail ?? 'Not allowed to open review rounds');
  throw new Error(result.body.detail ?? 'Failed to create review round');
}

export async function updateReviewRound(
  conferenceId: string,
  roundId: string,
  body: {
    status?: 'OPEN' | 'REVIEWING' | 'REBUTTAL' | 'DECIDING' | 'CLOSED';
    version: number;
  },
) {
  const result = await apiClient.review.updateRound({
    params: { conferenceId, roundId },
    body,
  });
  if (result.status === 200) return result.body;
  if (result.status === 409) throw new Error(result.body.detail ?? 'Conflict');
  throw new Error('Failed to update review round');
}

export async function fetchReviewerInvitations(conferenceId: string) {
  const result = await apiClient.review.listInvitations({ params: { conferenceId } });
  if (result.status === 200) return result.body.data;
  throw new Error('Failed to load invitations');
}

export async function issueReviewerInvitation(
  conferenceId: string,
  body: { email: string; roleNote?: string },
) {
  const result = await apiClient.review.issueInvitation({ params: { conferenceId }, body });
  if (result.status === 201) return result.body;
  if (result.status === 409) throw new Error(result.body.detail ?? 'Invitation exists');
  throw new Error('Failed to issue invitation');
}

export async function resendReviewerInvitation(conferenceId: string, invitationId: string) {
  const result = await apiClient.review.resendInvitation({
    params: { conferenceId, invitationId },
  });
  if (result.status === 200) return result.body;
  if (result.status === 409) throw new Error(result.body.detail ?? 'Cannot resend invitation');
  if (result.status === 404) throw new Error('Invitation not found');
  throw new Error('Failed to resend invitation');
}

export async function revokeReviewerInvitation(conferenceId: string, invitationId: string) {
  const result = await apiClient.review.revokeInvitation({
    params: { conferenceId, invitationId },
  });
  if (result.status === 204) return;
  if (result.status === 409) throw new Error(result.body.detail ?? 'Cannot remove invitation');
  if (result.status === 404) throw new Error('Invitation not found');
  throw new Error('Failed to remove invitation');
}

export async function acceptReviewerInvitation(token: string) {
  const result = await apiClient.review.acceptInvitation({ body: { token } });
  if (result.status === 200) return result.body;
  if (result.status === 409) throw new Error(result.body.detail ?? 'Cannot accept');
  throw new Error('Failed to accept invitation');
}

export async function acceptPendingReviewerInvitations() {
  const result = await apiClient.review.acceptPendingInvitations();
  if (result.status === 200) return result.body;
  throw new Error('Failed to accept pending invitations');
}

export async function declineReviewerInvitation(token: string) {
  const result = await apiClient.review.declineInvitation({ body: { token } });
  if (result.status === 200) return result.body;
  throw new Error('Failed to decline invitation');
}

export async function fetchPaperPool(conferenceId: string) {
  const result = await apiClient.review.getPaperPool({ params: { conferenceId }, query: {} });
  if (result.status === 200) return result.body;
  throw new Error('Failed to load paper pool');
}

export async function upsertBid(
  conferenceId: string,
  paperId: string,
  value: 'EAGER' | 'YES' | 'MAYBE' | 'NO' | 'CONFLICT',
) {
  const result = await apiClient.review.upsertBid({
    params: { conferenceId, paperId },
    body: { value },
  });
  if (result.status === 200) return result.body;
  if (result.status === 409) throw new Error(result.body.detail ?? 'Cannot bid');
  throw new Error('Failed to save bid');
}

export async function fetchCoiList(conferenceId: string) {
  const result = await apiClient.review.listCoi({ params: { conferenceId } });
  if (result.status === 200) return result.body.data;
  throw new Error('Failed to load conflicts of interest');
}

export async function fetchCoiDeclareTargets(conferenceId: string) {
  const result = await apiClient.review.listCoiDeclareTargets({ params: { conferenceId } });
  if (result.status === 200) return result.body.data;
  throw new Error('Failed to load papers for conflict declaration');
}

export async function declareCoi(
  conferenceId: string,
  body: {
    paperId?: string;
    withUserId?: string;
    type: 'CO_AUTHOR' | 'INSTITUTION' | 'ADVISOR_STUDENT' | 'PERSONAL' | 'FINANCIAL' | 'OTHER';
    note?: string;
  },
) {
  const result = await apiClient.review.declareCoi({ params: { conferenceId }, body });
  if (result.status === 201) return result.body;
  throw new Error('Failed to declare conflict');
}

export async function deleteCoi(conferenceId: string, coiId: string) {
  const result = await apiClient.review.deleteCoi({ params: { conferenceId, coiId } });
  if (result.status === 204) return;
  throw new Error('Failed to remove conflict');
}

export async function fetchBids(
  conferenceId: string,
  options?: { paperId?: string; limit?: number },
) {
  const result = await apiClient.review.listBids({
    params: { conferenceId },
    query: {
      ...(options?.paperId ? { paperId: options.paperId } : {}),
      ...(options?.limit ? { limit: options.limit } : {}),
    },
  });
  if (result.status === 200) return result.body.data;
  throw new Error('Failed to load bids');
}

export async function fetchAssignments(conferenceId: string, roundId: string) {
  const result = await apiClient.review.listAssignments({
    params: { conferenceId, roundId },
  });
  if (result.status === 200) return result.body.data;
  throw new Error('Failed to load assignments');
}

export async function createAssignment(
  conferenceId: string,
  paperId: string,
  body: { roundId: string; reviewerUserId: string },
) {
  const result = await apiClient.review.createAssignment({
    params: { conferenceId, paperId },
    body,
  });
  if (result.status === 201) return result.body;
  if (result.status === 409) throw new Error(result.body.detail ?? 'Cannot assign');
  throw new Error('Failed to assign reviewer');
}

export async function copyAssignmentsFromPreviousRound(
  conferenceId: string,
  roundId: string,
  body: { paperIds?: string[] } = {},
) {
  const result = await apiClient.review.copyAssignmentsFromPreviousRound({
    params: { conferenceId, roundId },
    body,
  });
  if (result.status === 200) return result.body;
  if (result.status === 400 || result.status === 409) {
    throw new Error(result.body.detail ?? 'Cannot copy assignments');
  }
  throw new Error('Failed to copy assignments from previous round');
}

export async function deleteAssignment(conferenceId: string, assignmentId: string) {
  const result = await apiClient.review.deleteAssignment({
    params: { conferenceId, assignmentId },
  });
  if (result.status === 204) return;
  throw new Error('Failed to remove assignment');
}

// --- Reviews (Phase 5) ---

export async function fetchMyAssignments(
  conferenceId: string,
  query?: { cursor?: string; limit?: number },
) {
  const result = await apiClient.review.listMyAssignments({
    params: { conferenceId },
    query: query ?? {},
  });
  if (result.status === 200) return result.body;
  throw new Error('Failed to load assignments');
}

export async function fetchAssignmentReview(conferenceId: string, assignmentId: string) {
  const result = await apiClient.review.getAssignmentReview({
    params: { conferenceId, assignmentId },
  });
  if (result.status === 200) return result.body;
  throw new Error('Failed to load review');
}

export async function saveReview(
  conferenceId: string,
  assignmentId: string,
  body: {
    scores: Record<string, number>;
    recommendation?: string | null;
    confidence?: number | null;
    commentsToAuthors?: string | null;
    commentsToChairs?: string | null;
    version: number;
  },
) {
  const result = await apiClient.review.saveAssignmentReview({
    params: { conferenceId, assignmentId },
    body: body as Parameters<typeof apiClient.review.saveAssignmentReview>[0]['body'],
  });
  if (result.status === 200) return result.body;
  if (result.status === 409) {
    const err = new Error(result.body.detail ?? 'Review was modified elsewhere') as Error & {
      status: number;
    };
    err.status = 409;
    throw err;
  }
  throw new Error('Failed to save review');
}

export async function submitReview(
  conferenceId: string,
  assignmentId: string,
  body: { version: number },
) {
  const result = await apiClient.review.submitAssignmentReview({
    params: { conferenceId, assignmentId },
    body,
  });
  if (result.status === 200) return result.body;
  if (result.status === 409) throw new Error(result.body.detail ?? 'Conflict');
  throw new Error('Failed to submit review');
}

export async function fetchPaperReviews(conferenceId: string, paperId: string, roundId?: string) {
  const result = await apiClient.review.listPaperReviews({
    params: { conferenceId, paperId },
    query: roundId ? { roundId } : {},
  });
  if (result.status === 200) return result.body;
  throw new Error('Failed to load reviews');
}

export async function releaseReviews(
  conferenceId: string,
  roundId: string,
  body: { version: number },
) {
  const result = await apiClient.review.releaseReviews({
    params: { conferenceId, roundId },
    body,
  });
  if (result.status === 200) return result.body;
  if (result.status === 409) throw new Error(result.body.detail ?? 'Conflict');
  throw new Error('Failed to release reviews');
}

export async function fetchRebuttal(conferenceId: string, paperId: string, roundId?: string) {
  const result = await apiClient.review.getRebuttal({
    params: { conferenceId, paperId },
    query: roundId ? { roundId } : {},
  });
  if (result.status === 200) return result.body;
  if (result.status === 404) return null;
  throw new Error('Failed to load rebuttal');
}

export async function submitRebuttal(
  conferenceId: string,
  paperId: string,
  body: { body: string; version?: number },
) {
  const result = await apiClient.review.submitRebuttal({
    params: { conferenceId, paperId },
    body,
  });
  if (result.status === 200) return result.body;
  if (result.status === 409) throw new Error(result.body.detail ?? 'Conflict');
  throw new Error('Failed to submit rebuttal');
}

// --- Decisions (Phase 6) ---

export async function fetchDecisions(conferenceId: string, roundId?: string) {
  const result = await apiClient.review.listDecisions({
    params: { conferenceId },
    query: roundId ? { roundId } : {},
  });
  if (result.status === 200) return result.body;
  throw new Error('Failed to load decisions');
}

export async function fetchPaperDecision(conferenceId: string, paperId: string, roundId?: string) {
  const result = await apiClient.review.getPaperDecision({
    params: { conferenceId, paperId },
    query: roundId ? { roundId } : {},
  });
  if (result.status === 200) return result.body;
  if (result.status === 404) return null;
  throw new Error('Failed to load decision');
}

export async function makeDecision(
  conferenceId: string,
  paperId: string,
  body: {
    roundId: string;
    outcome: 'ACCEPT' | 'REJECT' | 'MINOR_REVISION' | 'MAJOR_REVISION';
    rationale?: string | null;
    version: number;
    notify?: boolean;
  },
) {
  const result = await apiClient.review.makeDecision({
    params: { conferenceId, paperId },
    body,
  });
  if (result.status === 201) return result.body;
  if (result.status === 409) {
    const err = new Error(result.body.detail ?? 'Conflict') as Error & { status: number };
    err.status = 409;
    throw err;
  }
  throw new Error('Failed to record decision');
}

export async function bulkDecide(
  conferenceId: string,
  roundId: string,
  body: {
    items: Array<{
      paperId: string;
      outcome: 'ACCEPT' | 'REJECT' | 'MINOR_REVISION' | 'MAJOR_REVISION';
      rationale?: string | null;
    }>;
    notify?: boolean;
  },
) {
  const result = await apiClient.review.bulkDecide({
    params: { conferenceId, roundId },
    body,
  });
  if (result.status === 201) return result.body;
  if (result.status === 409) throw new Error(result.body.detail ?? 'Conflict');
  throw new Error('Failed to record bulk decisions');
}

export async function notifyDecisions(
  conferenceId: string,
  roundId: string,
  body?: { paperIds?: string[] },
) {
  const result = await apiClient.review.notifyDecisions({
    params: { conferenceId, roundId },
    body: body ?? {},
  });
  if (result.status === 200) return result.body;
  throw new Error('Failed to notify authors');
}

// --- Registration & payments (Phase 8) ---

export async function fetchRegistration(conferenceId: string, paperId: string) {
  const result = await apiClient.billing.getRegistration({
    params: { conferenceId, paperId },
  });
  if (result.status === 200) return result.body;
  if (result.status === 404) throw new Error('Registration not found');
  throw new Error('Failed to load registration');
}

export async function createRegistration(
  conferenceId: string,
  paperId: string,
  body: { audience: 'REGULAR' | 'STUDENT' },
) {
  const result = await apiClient.billing.createRegistration({
    params: { conferenceId, paperId },
    body,
  });
  if (result.status === 201) return result.body;
  if (result.status === 422) throw new Error(result.body.detail ?? 'Validation failed');
  throw new Error('Failed to create registration');
}

export async function initiateStudentDocUpload(
  conferenceId: string,
  paperId: string,
  body: { originalFilename: string; contentType: string; sizeBytes: number },
) {
  const result = await apiClient.billing.initiateStudentDocUpload({
    params: { conferenceId, paperId },
    body,
  });
  if (result.status === 200) return result.body;
  throw new Error('Failed to initiate document upload');
}

export async function completeStudentDocUpload(
  conferenceId: string,
  paperId: string,
  body: { objectKey: string },
) {
  const result = await apiClient.billing.completeStudentDocUpload({
    params: { conferenceId, paperId },
    body,
  });
  if (result.status === 201) return result.body;
  throw new Error('Failed to complete document upload');
}

export async function initiatePayment(conferenceId: string, paperId: string) {
  const result = await apiClient.billing.initiatePayment({
    params: { conferenceId, paperId },
    headers: { 'idempotency-key': crypto.randomUUID() },
    body: {},
  });
  if (result.status === 200) return result.body;
  if (result.status === 422) throw new Error(result.body.detail ?? 'Payment not allowed');
  throw new Error('Failed to initiate payment');
}

export async function fetchRegistrations(
  conferenceId: string,
  query?: { cursor?: string; limit?: number },
) {
  const result = await apiClient.billing.listRegistrations({
    params: { conferenceId },
    query: query ?? {},
  });
  if (result.status === 200) return result.body;
  throw new Error('Failed to load registrations');
}

export async function fetchStudentVerifications(conferenceId: string) {
  const result = await apiClient.billing.listStudentVerifications({
    params: { conferenceId },
  });
  if (result.status === 200) return result.body;
  throw new Error('Failed to load student verifications');
}

export async function reviewStudentVerification(
  conferenceId: string,
  verificationId: string,
  body: { action: 'APPROVE' | 'CLARIFY' | 'REJECT'; note?: string },
) {
  const result = await apiClient.billing.reviewStudentVerification({
    params: { conferenceId, verificationId },
    body,
  });
  if (result.status === 200) return result.body;
  throw new Error('Failed to review verification');
}

export async function refundRegistration(
  conferenceId: string,
  registrationId: string,
  body: { amountMinor: number; reason: string; version: number },
) {
  const result = await apiClient.billing.refundRegistration({
    params: { conferenceId, registrationId },
    body,
  });
  if (result.status === 200) return result.body;
  throw new Error('Failed to process refund');
}

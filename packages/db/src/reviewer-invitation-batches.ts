import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { invitationMetadataSchema, invitationRowIdSchema } from '@openconferences/schemas';
import {
  newInvitationSecret,
  openInvitationData,
  recordInvitationChange,
} from './reviewer-invitations.js';
export type InvitationBatchResult = {
  row: number;
  rowId: string | null;
  outcome: string;
  message: string;
  invitationId?: string;
  generation?: string;
};
// Every invocation commits a bounded chunk. The persistent processed count is
// the resume point; neither queue retries nor worker restarts repeat prior rows.
export async function processInvitationBatchChunk(
  tx: Prisma.TransactionClient,
  batchId: string,
  secret: string,
) {
  await tx.$queryRaw`SELECT id FROM reviewer_invitation_batches WHERE id=${batchId}::uuid FOR UPDATE`;
  const batch = await tx.reviewerInvitationBatch.findUnique({ where: { id: batchId } });
  if (!batch || ['COMPLETED', 'CANCELLED', 'FAILED'].includes(batch.status))
    return { done: true, processed: batch?.processed ?? 0 };
  // Revalidate authority after the potentially blocking conference lock. A key
  // revoked while this job waits must not authorize a fresh chunk of writes.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`invitation-changes:${batch.conferenceId}`},0))::text`;
  const grant = await tx.apiIntegration.findUnique({
    where: { id: batch.integrationId },
    select: {
      status: true,
      scopes: true,
      authorizedByUserId: true,
      authorizer: { select: { deletedAt: true, twoFactorEnabled: true } },
      conference: {
        select: { deletedAt: true, name: true, organization: { select: { deletedAt: true } } },
      },
    },
  });
  const credential = await tx.apiIntegrationKey.findUnique({
    where: { id: batch.keyId },
    select: {
      integrationId: true,
      conferenceId: true,
      scopes: true,
      expiresAt: true,
      revokedAt: true,
    },
  });
  const member =
    grant &&
    (await tx.membership.findFirst({
      where: {
        userId: grant.authorizedByUserId,
        OR: [
          { conferenceId: batch.conferenceId, scope: 'CONFERENCE' },
          { organizationId: batch.organizationId, scope: 'ORGANIZATION' },
        ],
        roles: { some: { role: { in: ['ORGANIZER', 'ORG_ADMIN'] } } },
      },
      select: { id: true },
    }));
  const required = [
    'invitations:write',
    'invitations:read',
    'reviewers:read',
    'reviewers:identity:read',
    'reviewers:contacts:read',
  ];
  if (
    !grant ||
    grant.status !== 'ACTIVE' ||
    grant.authorizer.deletedAt ||
    !grant.authorizer.twoFactorEnabled ||
    grant.conference.deletedAt ||
    grant.conference.organization.deletedAt ||
    !credential ||
    credential.integrationId !== batch.integrationId ||
    credential.conferenceId !== batch.conferenceId ||
    credential.revokedAt ||
    credential.expiresAt <= new Date() ||
    !member ||
    required.some((scope) => !grant.scopes.includes(scope) || !credential.scopes.includes(scope)) ||
    batch.expiresAt <= new Date()
  ) {
    await tx.reviewerInvitationBatch.update({
      where: { id: batchId },
      data: { status: 'CANCELLED', inputEncrypted: '' },
    });
    return { done: true, processed: batch.processed };
  }
  await tx.$executeRaw`SELECT set_config('app.current_user_id', ${grant.authorizedByUserId}, true),set_config('app.current_conference_id', ${batch.conferenceId}, true),set_config('app.current_org_id', ${batch.organizationId}, true)`;
  const input = JSON.parse(openInvitationData(batch.inputEncrypted, secret)) as {
    rows: unknown[];
    lifetimeDays: number;
  };
  const results = batch.results as InvitationBatchResult[];
  const first = new Map<string, number>();
  input.rows.forEach((row, index) => {
    const parsed = invitationMetadataSchema.safeParse(row);
    if (parsed.success) {
      const email = parsed.data.email.toLowerCase();
      if (!first.has(email)) first.set(email, index);
    }
  });
  const last = Math.min(batch.processed + 25, input.rows.length);
  for (let index = batch.processed; index < last; index++) {
    const raw = input.rows[index];
    const parsedRowId = invitationRowIdSchema.safeParse(
      raw && typeof raw === 'object' && 'rowId' in raw ? raw.rowId : undefined,
    );
    const rowId = parsedRowId.success ? (parsedRowId.data ?? null) : null;
    const base = { row: index + 1, rowId };
    const parsed = invitationMetadataSchema.safeParse(raw);
    if (!parsed.success) {
      results.push({
        ...base,
        outcome: 'INVALID',
        message: parsed.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; '),
      });
      continue;
    }
    const data = parsed.data,
      email = data.email.toLowerCase();
    if (first.get(email) !== index) {
      results.push({
        ...base,
        outcome: 'DUPLICATE_IN_BATCH',
        message: `Same email as row ${(first.get(email) ?? 0) + 1}`,
      });
      continue;
    }
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`reviewer-invite:${batch.conferenceId}:${email}`},0))::text`;
    const user = await tx.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null },
      select: { id: true },
    });
    if (
      user &&
      (await tx.membership.findFirst({
        where: {
          conferenceId: batch.conferenceId,
          userId: user.id,
          scope: 'CONFERENCE',
          roles: { some: { role: 'REVIEWER' } },
        },
        select: { id: true },
      }))
    ) {
      results.push({
        ...base,
        outcome: 'SKIPPED_REVIEWER',
        message: 'Already has reviewer access in this conference',
      });
      continue;
    }
    if (
      (await tx.authorship.findFirst({
        where: {
          paper: { conferenceId: batch.conferenceId },
          email: { equals: email, mode: 'insensitive' },
        },
        select: { id: true },
      })) ||
      (user &&
        (await tx.paper.findFirst({
          where: { conferenceId: batch.conferenceId, submittedById: user.id },
          select: { id: true },
        })))
    ) {
      results.push({ ...base, outcome: 'SKIPPED_AUTHOR', message: 'An author in this conference' });
      continue;
    }
    const existing = await tx.reviewerInvitation.findMany({
      where: { conferenceId: batch.conferenceId, email: { equals: email, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
    });
    let invitation = existing.find(
      (row) => row.status === 'PENDING' && !row.revokedAt && row.expiresAt > new Date(),
    );
    if (invitation) {
      if (!invitation.sentAt) {
        invitation = await tx.reviewerInvitation.update({
          where: { id: invitation.id },
          data: { sentAt: new Date(), version: { increment: 1 } },
        });
        await recordInvitationChange(
          tx,
          invitation,
          'SENT_LINK_GENERATED',
          grant.authorizedByUserId,
        );
      }
      results.push({
        ...base,
        outcome: 'EXISTING',
        invitationId: invitation.id,
        message: 'An active invitation already exists',
      });
      continue;
    }
    if (
      existing.some(
        (row) => row.status === 'DECLINED' || row.status === 'ACCEPTED' || row.revokedAt,
      )
    ) {
      results.push({
        ...base,
        outcome: 'CLOSED_INVITATION',
        invitationId: existing[0]!.id,
        message: 'Closed invitation retained; explicit re-invitation is required',
      });
      continue;
    }
    const token = newInvitationSecret(secret);
    invitation = await tx.reviewerInvitation.create({
      data: {
        id: randomUUID(),
        organizationId: batch.organizationId,
        conferenceId: batch.conferenceId,
        conferenceName: grant.conference.name,
        email,
        displayName: data.name,
        affiliation: data.affiliation,
        researchFields: [...new Set(data.researchFields.map((field) => field.toLowerCase()))],
        externalReference: data.externalReference,
        invitedUserId: user?.id,
        token: token.token,
        tokenCiphertext: token.tokenCiphertext,
        sentAt: new Date(),
        expiresAt: new Date(Date.now() + input.lifetimeDays * 86400000),
      },
    });
    await recordInvitationChange(tx, invitation, 'SENT_LINK_GENERATED', grant.authorizedByUserId);
    results.push({
      ...base,
      outcome: 'CREATED',
      invitationId: invitation.id,
      generation: invitation.token,
      message: 'Links generated; marked sent. No email dispatched.',
    });
  }
  await tx.reviewerInvitationBatch.update({
    where: { id: batchId },
    data: {
      processed: last,
      results: results as unknown as Prisma.InputJsonValue,
      status: last === input.rows.length ? 'COMPLETED' : 'RUNNING',
    },
  });
  return { done: last === input.rows.length, processed: last };
}

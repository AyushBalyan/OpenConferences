import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { RoleKind, TenantContext, VersionKind } from '@openconferences/db';
import { withTenantContext } from '@openconferences/db';
import type { CompleteVersionInput, InitiateVersionInput } from '@openconferences/schemas';
import { FilesService } from '../files/files.service';
import { ConferenceService } from '../tenancy/conference.service';
import { PapersService } from './papers.service';
import { isPrivilegedReader, mapPaperVersion } from './submission.mapper';

type PaperForUpload = {
  id: string;
  organizationId: string;
  conferenceId: string;
  submittedById: string;
  status: string;
  authorships: { userId: string | null }[];
};

@Injectable()
export class VersionsService {
  constructor(
    private readonly papers: PapersService,
    private readonly files: FilesService,
    private readonly conferences: ConferenceService,
  ) {}

  async initiate(
    userId: string,
    conferenceId: string,
    paperId: string,
    input: InitiateVersionInput,
    roles: RoleKind[],
  ) {
    const paper = await this.papers.loadPaper(userId, conferenceId, paperId, roles);
    await this.assertCanUploadVersion(userId, conferenceId, paper, input.kind, roles);

    const versionNumber = await this.nextVersionNumber(paperId, input.kind, {
      userId,
      conferenceId,
      organizationId: paper.organizationId,
    });

    const presigned = await this.files.presignUpload({
      organizationId: paper.organizationId,
      conferenceId,
      paperId,
      userId,
      kind: input.kind,
      originalFilename: input.originalFilename,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      versionNumber,
    });

    return {
      uploadUrl: presigned.uploadUrl,
      objectKey: presigned.objectKey,
      expiresInSeconds: 900,
    };
  }

  async complete(
    userId: string,
    conferenceId: string,
    paperId: string,
    input: CompleteVersionInput,
    roles: RoleKind[],
  ) {
    const paper = await this.papers.loadPaper(userId, conferenceId, paperId, roles);
    await this.assertCanUploadVersion(userId, conferenceId, paper, input.kind, roles);

    const version = await this.files.finalizeUpload({
      organizationId: paper.organizationId,
      conferenceId,
      paperId,
      userId,
      objectKey: input.objectKey,
      kind: input.kind,
      note: input.note,
    });

    return mapPaperVersion(version);
  }

  async download(
    userId: string,
    conferenceId: string,
    paperId: string,
    versionId: string,
    roles: RoleKind[],
    disposition: 'attachment' | 'inline' = 'attachment',
  ) {
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);

    const paper = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.paper.findFirst({
          where: { id: paperId, conferenceId },
          include: { authorships: { select: { userId: true } } },
        }),
    );

    if (!paper) {
      throw new NotFoundException('Paper not found');
    }

    const access = await this.resolveDownloadAccess(userId, conferenceId, paper, roles);
    if (!access.allowed) {
      throw new NotFoundException('Paper not found');
    }

    const version = await withTenantContext(
      { userId, conferenceId, organizationId: paper.organizationId },
      async (tx) =>
        tx.paperVersion.findFirst({
          where: { id: versionId, paperId },
          include: { fileAsset: true },
        }),
    );

    if (!version) {
      throw new NotFoundException('Version not found');
    }

    // Assigned reviewers may only fetch the paper's current (assigned) artifact.
    if (access.mode === 'assigned_reviewer' && paper.currentVersionId !== versionId) {
      throw new NotFoundException('Version not found');
    }

    return this.files.presignDownload(
      version.fileAssetId,
      userId,
      paper.organizationId,
      disposition,
    );
  }

  private async resolveDownloadAccess(
    userId: string,
    conferenceId: string,
    paper: {
      id: string;
      submittedById: string;
      authorships: { userId: string | null }[];
    },
    roles: RoleKind[],
  ): Promise<
    { allowed: true; mode: 'privileged' | 'author' | 'assigned_reviewer' } | { allowed: false }
  > {
    if (isPrivilegedReader(roles)) {
      return { allowed: true, mode: 'privileged' };
    }

    const isAuthor =
      paper.submittedById === userId || paper.authorships.some((a) => a.userId === userId);
    if (isAuthor) {
      return { allowed: true, mode: 'author' };
    }

    if (!roles.includes('REVIEWER')) {
      return { allowed: false };
    }

    const assignment = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.reviewerAssignment.findFirst({
        where: {
          conferenceId,
          paperId: paper.id,
          reviewerUserId: userId,
          status: { in: ['ASSIGNED', 'ACCEPTED', 'COMPLETED'] },
        },
        select: { id: true },
      }),
    );

    if (!assignment) {
      return { allowed: false };
    }

    return { allowed: true, mode: 'assigned_reviewer' };
  }

  private async assertCanUploadVersion(
    userId: string,
    conferenceId: string,
    paper: PaperForUpload,
    kind: VersionKind,
    roles: RoleKind[],
  ): Promise<void> {
    if (kind === 'CAMERA_READY') {
      this.assertAuthorOnly(userId, paper);
      await this.assertCameraReadyEligible(userId, conferenceId, paper, roles);
      return;
    }

    if (kind === 'SUBMISSION') {
      this.assertAuthorCanUpload(userId, paper, roles);
      if (paper.status !== 'DRAFT') {
        throw new ConflictException('Submission versions can only be uploaded for draft papers');
      }
      return;
    }

    if (kind === 'REVISION') {
      this.assertAuthorOnly(userId, paper, 'Only paper authors can upload a revised manuscript');
      await this.assertRevisionEligible(userId, conferenceId, paper);
      return;
    }

    throw new ConflictException(`Version kind ${kind} is not supported for upload yet`);
  }

  private async assertCameraReadyEligible(
    userId: string,
    conferenceId: string,
    paper: PaperForUpload,
    roles: RoleKind[],
  ): Promise<void> {
    if (paper.status === 'WITHDRAWN' || paper.status === 'WITHDRAWN_NONPAYMENT') {
      throw new ConflictException('Camera-ready upload is not available for withdrawn papers');
    }

    if (paper.status === 'DRAFT' || paper.status === 'SUBMITTED') {
      throw new ConflictException('Camera-ready upload is only available after acceptance');
    }

    const allowedStatuses = new Set(['DECISION_MADE', 'CAMERA_READY']);
    if (!allowedStatuses.has(paper.status)) {
      throw new ConflictException('Camera-ready upload is only available for accepted papers');
    }

    const decision = await withTenantContext(
      { userId, conferenceId, organizationId: paper.organizationId },
      async (tx) =>
        tx.decision.findFirst({
          where: { paperId: paper.id, conferenceId, outcome: 'ACCEPT' },
          orderBy: { createdAt: 'desc' },
        }),
    );

    if (!decision) {
      throw new ConflictException('Camera-ready upload requires an acceptance decision');
    }

    if (!decision.notifiedAt) {
      throw new NotFoundException('Paper not found');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);

    if (!conference.cameraReadyDueAt) {
      throw new UnprocessableEntityException(
        'Camera-ready deadline is not configured for this conference',
      );
    }

    if (new Date() > conference.cameraReadyDueAt) {
      throw new UnprocessableEntityException('Camera-ready deadline has passed');
    }
  }

  private async nextVersionNumber(
    paperId: string,
    kind: VersionKind,
    ctx: TenantContext,
  ): Promise<number> {
    const latest = await withTenantContext(ctx, async (tx) =>
      tx.paperVersion.findFirst({
        where: { paperId, kind },
        orderBy: { versionNumber: 'desc' },
      }),
    );

    return (latest?.versionNumber ?? 0) + 1;
  }

  private async assertRevisionEligible(
    userId: string,
    conferenceId: string,
    paper: PaperForUpload,
  ): Promise<void> {
    if (paper.status === 'WITHDRAWN' || paper.status === 'WITHDRAWN_NONPAYMENT') {
      throw new ConflictException('A revision cannot be uploaded for a withdrawn paper');
    }

    if (paper.status !== 'UNDER_REVIEW') {
      throw new ConflictException(
        'A revision can be uploaded only while the paper is under review',
      );
    }

    const gate = await withTenantContext(
      { userId, conferenceId, organizationId: paper.organizationId },
      async (tx) => {
        const latest = await tx.reviewRound.findFirst({
          where: { paperId: paper.id, conferenceId },
          orderBy: { roundNumber: 'desc' },
          include: { decisions: { take: 1 } },
        });
        if (!latest) return null;

        const latestOutcome = latest.decisions[0]?.outcome;
        if (latestOutcome === 'MINOR_REVISION' || latestOutcome === 'MAJOR_REVISION') {
          return { decision: latest.decisions[0]!, deadline: latest.revisionDueAt };
        }

        const previous = await tx.reviewRound.findFirst({
          where: { paperId: paper.id, conferenceId, roundNumber: latest.roundNumber - 1 },
          include: { decisions: { take: 1 } },
        });
        const previousOutcome = previous?.decisions[0]?.outcome;
        if (
          !previous ||
          (previousOutcome !== 'MINOR_REVISION' && previousOutcome !== 'MAJOR_REVISION')
        ) {
          return null;
        }

        const assignmentCount = await tx.reviewerAssignment.count({
          where: { roundId: latest.id, conferenceId },
        });
        if (assignmentCount > 0) {
          return { blocked: true as const };
        }

        return { decision: previous.decisions[0]!, deadline: previous.revisionDueAt };
      },
    );

    if (gate && 'blocked' in gate) {
      throw new ConflictException(
        'A revised PDF can no longer be replaced after reviewers are assigned to the next cycle',
      );
    }

    if (!gate) {
      throw new ConflictException('A revision decision is required before uploading a revision');
    }

    if (!gate.decision.notifiedAt) {
      throw new NotFoundException('Paper not found');
    }

    if (!gate.deadline) {
      throw new UnprocessableEntityException('Revision deadline is not configured for this paper');
    }

    if (new Date() > gate.deadline) {
      throw new UnprocessableEntityException('Revision deadline has passed');
    }
  }

  private assertAuthorOnly(
    userId: string,
    paper: { submittedById: string; authorships: { userId: string | null }[] },
    message = 'Only paper authors can upload camera-ready versions',
  ) {
    const isAuthor =
      paper.submittedById === userId || paper.authorships.some((a) => a.userId === userId);

    if (!isAuthor) {
      throw new ForbiddenException(message);
    }
  }

  private assertAuthorCanUpload(
    userId: string,
    paper: { submittedById: string; authorships: { userId: string | null }[] },
    roles: RoleKind[],
  ) {
    if (isPrivilegedReader(roles)) {
      return;
    }

    this.assertAuthorOnly(userId, paper);
  }
}

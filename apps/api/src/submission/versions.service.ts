import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { RoleKind, VersionKind } from '@openconferences/db';
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

    const versionNumber = await this.nextVersionNumber(paperId, input.kind);

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

    return this.files.presignDownload(version.fileAssetId, userId, paper.organizationId);
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

  private async nextVersionNumber(paperId: string, kind: VersionKind): Promise<number> {
    const latest = await withTenantContext({ bypass: true }, async (tx) =>
      tx.paperVersion.findFirst({
        where: { paperId, kind },
        orderBy: { versionNumber: 'desc' },
      }),
    );

    return (latest?.versionNumber ?? 0) + 1;
  }

  private assertAuthorOnly(
    userId: string,
    paper: { submittedById: string; authorships: { userId: string | null }[] },
  ) {
    const isAuthor =
      paper.submittedById === userId || paper.authorships.some((a) => a.userId === userId);

    if (!isAuthor) {
      throw new ForbiddenException('Only paper authors can upload camera-ready versions');
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

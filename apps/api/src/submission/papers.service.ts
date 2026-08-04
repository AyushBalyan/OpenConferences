import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Authorship, FileAsset, Paper, PaperVersion, RoleKind } from '@openconferences/db';
import { generateId, withTenantContext } from '@openconferences/db';
import type { CreatePaperInput, UpdatePaperInput } from '@openconferences/schemas';
import {
  paginateItems,
  prismaCursorArgs,
  resolveLimit,
  type CursorPaginationOptions,
} from '../common/pagination/cursor';
import { assertScope } from '../common/scope/assert-scope';
import { AuditService } from '../audit/audit.service';
import { NotificationPublisher } from '../messaging/notification.publisher';
import { ConferenceService } from '../tenancy/conference.service';
import { isPrivilegedReader, mapPaper } from './submission.mapper';

const paperInclude = {
  authorships: { orderBy: { order: 'asc' as const } },
  currentVersion: { include: { fileAsset: true } },
  versions: {
    where: { kind: 'CAMERA_READY' as const },
    orderBy: { versionNumber: 'desc' as const },
    take: 1,
    include: { fileAsset: true },
  },
};

type LoadedPaper = Paper & {
  authorships: Authorship[];
  currentVersion: (PaperVersion & { fileAsset: FileAsset }) | null;
  versions?: (PaperVersion & { fileAsset: FileAsset })[];
};

@Injectable()
export class PapersService {
  constructor(
    private readonly conferences: ConferenceService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationPublisher,
  ) {}

  async create(userId: string, conferenceId: string, input: CreatePaperInput, roles: RoleKind[]) {
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    this.assertCfpOpen(conference);

    if (!roles.includes('AUTHOR') && !isPrivilegedReader(roles)) {
      throw new ForbiddenException('Author role required to create submissions');
    }

    const trackId = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        this.resolveSubmissionTrackId(tx, conferenceId, conference.organizationId, input.trackId),
    );

    const user = await withTenantContext({ userId }, async (tx) =>
      tx.user.findUnique({ where: { id: userId } }),
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const paper = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.paper.create({
          data: {
            id: generateId(),
            organizationId: conference.organizationId,
            conferenceId,
            trackId,
            submittedById: userId,
            title: input.title,
            abstract: input.abstract,
            keywords: input.keywords,
            status: 'DRAFT',
            authorships: {
              create: {
                id: generateId(),
                userId,
                order: 1,
                isCorresponding: true,
                fullName: user.name,
                email: user.email,
                ...(input.correspondingAffiliation
                  ? { affiliation: input.correspondingAffiliation }
                  : {}),
              },
            },
          },
          include: paperInclude,
        }),
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'paper.created',
      entity: 'Paper',
      entityId: paper.id,
    });

    return mapPaper(paper);
  }

  async list(
    userId: string,
    conferenceId: string,
    roles: RoleKind[],
    options: CursorPaginationOptions & {
      mine?: boolean;
      status?: LoadedPaper['status'];
      trackId?: string;
      q?: string;
    },
  ) {
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const limit = resolveLimit(options.limit);
    const privileged = isPrivilegedReader(roles);
    const mineOnly = options.mine ?? !privileged;

    const rows = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.paper.findMany({
          where: {
            conferenceId,
            ...(mineOnly
              ? { OR: [{ submittedById: userId }, { authorships: { some: { userId } } }] }
              : {}),
            ...(options.status ? { status: options.status } : {}),
            ...(options.trackId ? { trackId: options.trackId } : {}),
            ...(options.q ? { title: { contains: options.q, mode: 'insensitive' } } : {}),
          },
          include: paperInclude,
          orderBy: { createdAt: 'desc' },
          ...prismaCursorArgs(options, limit),
        }),
    );

    const page = paginateItems(rows, limit, (row) => row.id);

    return {
      data: page.data.map(mapPaper),
      nextCursor: page.nextCursor,
    };
  }

  async get(userId: string, conferenceId: string, paperId: string, roles: RoleKind[]) {
    const paper = await this.loadPaper(userId, conferenceId, paperId, roles);
    return mapPaper(paper);
  }

  async update(
    userId: string,
    conferenceId: string,
    paperId: string,
    input: UpdatePaperInput,
    roles: RoleKind[],
  ) {
    const paper = await this.loadPaper(userId, conferenceId, paperId, roles);
    await this.assertAuthorCanEdit(userId, paper, roles);

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    this.assertCfpOpen(conference);

    if (paper.status !== 'DRAFT') {
      throw new ConflictException('Only draft papers can be edited');
    }

    if (input.version !== paper.version) {
      throw new ConflictException('Paper was modified by another request');
    }

    if (input.trackId) {
      const track = await withTenantContext(
        { userId, conferenceId, organizationId: paper.organizationId },
        async (tx) =>
          tx.track.findFirst({
            where: { id: input.trackId, conferenceId, deletedAt: null },
          }),
      );
      if (!track) {
        throw new NotFoundException('Track not found');
      }
    }

    const updated = await withTenantContext(
      { userId, conferenceId, organizationId: paper.organizationId },
      async (tx) =>
        tx.paper.update({
          where: { id: paperId },
          data: {
            title: input.title,
            abstract: input.abstract,
            keywords: input.keywords,
            trackId: input.trackId,
            version: { increment: 1 },
          },
          include: paperInclude,
        }),
    );

    return mapPaper(updated);
  }

  async submit(userId: string, conferenceId: string, paperId: string, roles: RoleKind[]) {
    const paper = await this.loadPaper(userId, conferenceId, paperId, roles);
    await this.assertAuthorCanEdit(userId, paper, roles);

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    this.assertCfpOpen(conference);

    if (paper.status !== 'DRAFT') {
      throw new ConflictException('Paper has already been submitted');
    }

    if (!paper.title.trim() || !paper.abstract.trim()) {
      throw new ConflictException('Title and abstract are required');
    }

    if (paper.authorships.length === 0) {
      throw new ConflictException('At least one author is required');
    }

    if (!paper.authorships.some((a) => a.isCorresponding)) {
      throw new ConflictException('A corresponding author is required');
    }

    if (!paper.currentVersionId) {
      throw new ConflictException('A scanned PDF version is required before submission');
    }

    const currentVersion = paper.currentVersion;
    if (!currentVersion || currentVersion.fileAsset?.scanStatus !== 'CLEAN') {
      throw new ConflictException('Current version must be scanned and clean before submission');
    }

    const updated = await withTenantContext(
      { userId, conferenceId, organizationId: paper.organizationId },
      async (tx) =>
        tx.paper.update({
          where: { id: paperId },
          data: { status: 'SUBMITTED', version: { increment: 1 } },
          include: paperInclude,
        }),
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: paper.organizationId,
      conferenceId,
      action: 'paper.submitted',
      entity: 'Paper',
      entityId: paperId,
    });

    const corresponding = paper.authorships.find((a) => a.isCorresponding) ?? paper.authorships[0];
    if (corresponding) {
      await this.notifications.publishPaperSubmitted({
        to: corresponding.email,
        paperId,
        paperTitle: paper.title,
        conferenceId,
        organizationId: paper.organizationId,
        idempotencyKey: `submission-confirmed-${paperId}`,
      });
    }

    return mapPaper(updated);
  }

  async loadPaper(
    userId: string,
    conferenceId: string,
    paperId: string,
    roles: RoleKind[],
  ): Promise<LoadedPaper> {
    await this.conferences.loadConference(userId, conferenceId, roles);

    const paper = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.paper.findFirst({
        where: { id: paperId },
        include: paperInclude,
      }),
    );

    if (!paper) {
      throw new NotFoundException('Paper not found');
    }

    assertScope(paper, { conferenceId });

    if (!isPrivilegedReader(roles)) {
      const isAuthor =
        paper.submittedById === userId || paper.authorships.some((a) => a.userId === userId);
      if (!isAuthor) {
        throw new NotFoundException('Paper not found');
      }
    }

    return paper;
  }

  private assertCfpOpen(conference: { status: string }) {
    if (conference.status !== 'CFP_OPEN') {
      throw new ConflictException('Conference is not accepting submissions');
    }
  }

  private async resolveSubmissionTrackId(
    tx: Parameters<Parameters<typeof withTenantContext>[1]>[0],
    conferenceId: string,
    organizationId: string,
    requestedTrackId?: string,
  ): Promise<string> {
    if (requestedTrackId) {
      const requested = await tx.track.findFirst({
        where: { id: requestedTrackId, conferenceId, deletedAt: null },
      });
      if (!requested) {
        throw new NotFoundException('Track not found');
      }
      return requested.id;
    }

    const existing = await tx.track.findFirst({
      where: { conferenceId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) {
      return existing.id;
    }

    const created = await tx.track.create({
      data: {
        id: generateId(),
        conferenceId,
        organizationId,
        slug: 'main',
        name: 'Main Track',
      },
    });

    return created.id;
  }

  private async assertAuthorCanEdit(userId: string, paper: LoadedPaper, roles: RoleKind[]) {
    if (isPrivilegedReader(roles)) {
      return;
    }

    const isAuthor =
      paper.submittedById === userId || paper.authorships.some((a) => a.userId === userId);

    if (!isAuthor) {
      throw new ForbiddenException('Only paper authors can edit this submission');
    }
  }
}

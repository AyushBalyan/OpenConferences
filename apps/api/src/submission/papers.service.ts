import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  generateId,
  generateSubmissionNumber,
  withTenantContext,
  type Authorship,
  type FileAsset,
  type Paper,
  type PaperVersion,
  type RoleKind,
} from '@openconferences/db';
import type {
  CreatePaperInput,
  UpdatePaperInput,
  WithdrawPaperInput,
} from '@openconferences/schemas';
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
import { canCoordinateReview } from '../tenancy/role-hierarchy';
import { isPrivilegedReader, mapPaper } from './submission.mapper';

const paperInclude = {
  authorships: { orderBy: { order: 'asc' as const } },
  currentVersion: { include: { fileAsset: true } },
  versions: {
    orderBy: { createdAt: 'desc' as const },
    take: 20,
    include: { fileAsset: true },
  },
  reviewRounds: {
    orderBy: { roundNumber: 'desc' as const },
    take: 1,
    select: { id: true, revisionDueAt: true },
  },
};

type LoadedPaper = Paper & {
  authorships: Authorship[];
  currentVersion: (PaperVersion & { fileAsset: FileAsset }) | null;
  versions?: (PaperVersion & { fileAsset: FileAsset })[];
  reviewRounds?: { id: string; revisionDueAt: Date | null }[];
};

function formatAuthorList(authorships: Authorship[]): string {
  return authorships
    .map((author) => {
      const affiliation = author.affiliation?.trim();
      return affiliation ? `${author.fullName} (${affiliation})` : author.fullName;
    })
    .join('; ');
}

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

    const search = options.q?.trim();
    const filters = [
      ...(mineOnly
        ? [{ OR: [{ submittedById: userId }, { authorships: { some: { userId } } }] }]
        : []),
      ...(search
        ? [
            {
              OR: [
                { title: { contains: search, mode: 'insensitive' as const } },
                {
                  authorships: {
                    some: { fullName: { contains: search, mode: 'insensitive' as const } },
                  },
                },
              ],
            },
          ]
        : []),
    ];

    const rows = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.paper.findMany({
          where: {
            conferenceId,
            ...(options.status ? { status: options.status } : {}),
            ...(options.trackId ? { trackId: options.trackId } : {}),
            ...(filters.length > 0 ? { AND: filters } : {}),
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

    {
      const latestVersion = await withTenantContext(
        { userId, conferenceId, organizationId: paper.organizationId },
        async (tx) =>
          tx.paperVersion.findFirst({
            where: { paperId, kind: { in: ['SUBMISSION', 'REVISION'] } },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            include: { fileAsset: true },
          }),
      );

      if (latestVersion?.fileAsset.scanStatus === 'PENDING_SCAN') {
        throw new ConflictException(
          'PDF is still being scanned. Please wait a moment and try again.',
        );
      }

      if (latestVersion?.fileAsset.scanStatus === 'INFECTED') {
        throw new ConflictException(
          'The uploaded PDF failed security scanning. Please upload a different file.',
        );
      }

      if (!paper.currentVersionId) {
        throw new ConflictException('A scanned PDF version is required before submission');
      }
      if (latestVersion && latestVersion.id !== paper.currentVersionId) {
        throw new ConflictException(
          'The latest PDF is not ready for submission. Please wait for scanning to complete.',
        );
      }
    }

    const currentVersion = paper.currentVersion;
    if (!currentVersion || currentVersion.fileAsset?.scanStatus !== 'CLEAN') {
      throw new ConflictException('Current version must be scanned and clean before submission');
    }

    const updated = await this.assignSubmissionNumber(userId, paper, conference.slug);

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
        conferenceName: conference.name,
        conferenceId,
        organizationId: paper.organizationId,
        authorEmail: corresponding.email,
        authorName: corresponding.fullName,
        authorAffiliation: corresponding.affiliation?.trim() || undefined,
        authorList: formatAuthorList(paper.authorships),
        idempotencyKey: `submission-confirmed-${paperId}`,
      });
    }

    return mapPaper(updated);
  }

  async withdraw(
    userId: string,
    conferenceId: string,
    paperId: string,
    input: WithdrawPaperInput,
    roles: RoleKind[],
  ) {
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const paper = await this.loadPaperForMutation(userId, conferenceId, paperId);
    const isAuthor = this.isPaperAuthor(userId, paper);
    const coordinator = canCoordinateReview(roles) && !isAuthor;

    if (!isAuthor && !canCoordinateReview(roles)) {
      throw new ForbiddenException('Only an author or organizer can withdraw this paper');
    }

    if (isAuthor && paper.status !== 'SUBMITTED') {
      if (paper.status === 'DRAFT') {
        throw new ConflictException('Delete the draft instead of withdrawing it');
      }
      if (paper.status.startsWith('WITHDRAWN')) {
        throw new ConflictException('This paper is already withdrawn');
      }
      throw new ForbiddenException('Contact the organizers to withdraw this paper');
    }

    if (coordinator && !this.coordinatorMayWithdraw(paper.status)) {
      throw new ConflictException(
        paper.status === 'DRAFT'
          ? 'Organizers cannot withdraw a draft'
          : 'This paper cannot be withdrawn',
      );
    }

    const allowedStatuses = (
      isAuthor ? ['SUBMITTED'] : ['SUBMITTED', 'UNDER_REVIEW', 'DECISION_MADE', 'CAMERA_READY']
    ) as Array<'SUBMITTED' | 'UNDER_REVIEW' | 'DECISION_MADE' | 'CAMERA_READY'>;

    const result = await withTenantContext(
      { userId, conferenceId, organizationId: paper.organizationId },
      async (tx) => {
        const updated = await tx.paper.updateMany({
          where: { id: paperId, version: input.version, status: { in: allowedStatuses } },
          data: { status: 'WITHDRAWN', version: { increment: 1 } },
        });
        if (updated.count !== 1) {
          return null;
        }

        await tx.reviewerAssignment.updateMany({
          where: { paperId, status: { not: 'COMPLETED' } },
          data: { status: 'DECLINED' },
        });

        const registration = await tx.registration.findFirst({ where: { paperId, conferenceId } });
        const paid = registration?.status === 'PAID';
        if (
          registration &&
          (registration.status === 'PENDING' ||
            registration.status === 'AWAITING_VERIFICATION' ||
            registration.status === 'ADDITIONAL_PAYMENT_REQUIRED')
        ) {
          await tx.registration.update({
            where: { id: registration.id },
            data: { status: 'CANCELLED', version: { increment: 1 } },
          });
        }

        const fresh = await tx.paper.findFirst({
          where: { id: paperId },
          include: paperInclude,
        });
        return { paper: fresh, paid };
      },
    );

    if (!result?.paper) {
      throw new ConflictException('Paper was modified by another request');
    }

    await this.audit.log({
      actorUserId: userId,
      organizationId: paper.organizationId,
      conferenceId,
      action: 'paper.withdrawn',
      entity: 'Paper',
      entityId: paperId,
      diff: {
        previousStatus: paper.status,
        reason: input.reason,
        actor: isAuthor ? 'author' : 'organizer',
        paidRegistration: result.paid,
      },
    });

    const authorEmails = [
      ...new Set(
        paper.authorships.map((author) => author.email.trim().toLowerCase()).filter(Boolean),
      ),
    ];
    for (const email of authorEmails) {
      await this.notifications.publishPaperWithdrawn({
        to: email,
        audience: 'author',
        paperId,
        paperTitle: paper.title,
        submissionNumber: paper.submissionNumber,
        conferenceName: conference.name,
        conferenceId,
        organizationId: paper.organizationId,
        reason: input.reason,
        idempotencyKey: `paper-withdrawn-${paperId}-${email}`,
      });
    }

    const staff = await withTenantContext(
      { userId, conferenceId, organizationId: paper.organizationId },
      async (tx) =>
        tx.membership.findMany({
          where: {
            conferenceId,
            roles: { some: { role: { in: ['ORGANIZER', 'CHAIR', 'ORG_ADMIN'] } } },
          },
          include: { user: { select: { email: true, name: true } } },
        }),
    );
    const actorName =
      staff.find((member) => member.userId === userId)?.user.name ??
      paper.authorships.find((author) => author.userId === userId)?.fullName ??
      'An author';
    const alreadyTold = new Set(authorEmails);
    for (const member of staff) {
      const email = member.user.email.trim().toLowerCase();
      if (!email || alreadyTold.has(email)) continue;
      alreadyTold.add(email);
      await this.notifications.publishPaperWithdrawn({
        to: email,
        audience: 'organizer',
        paperId,
        paperTitle: paper.title,
        submissionNumber: paper.submissionNumber,
        conferenceName: conference.name,
        conferenceId,
        organizationId: paper.organizationId,
        reason: input.reason,
        actorName,
        refundNeeded: result.paid,
        idempotencyKey: `paper-withdrawn-organizer-${paperId}-${email}`,
      });
    }

    return mapPaper(result.paper);
  }

  async deleteDraft(userId: string, conferenceId: string, paperId: string, roles: RoleKind[]) {
    await this.conferences.loadConference(userId, conferenceId, roles);
    const paper = await this.loadPaperForMutation(userId, conferenceId, paperId);
    if (!this.isPaperAuthor(userId, paper)) {
      throw new ForbiddenException('Only an author can delete this draft');
    }
    if (paper.status !== 'DRAFT') {
      throw new ConflictException('Only a draft can be deleted');
    }

    const deleted = await withTenantContext(
      { userId, conferenceId, organizationId: paper.organizationId },
      async (tx) => {
        await tx.paper.updateMany({
          where: { id: paperId, status: 'DRAFT' },
          data: { currentVersionId: null },
        });
        return tx.paper.deleteMany({ where: { id: paperId, status: 'DRAFT' } });
      },
    );

    if (deleted.count !== 1) {
      throw new ConflictException('This draft can no longer be deleted');
    }

    await this.audit.log({
      actorUserId: userId,
      organizationId: paper.organizationId,
      conferenceId,
      action: 'paper.deleted',
      entity: 'Paper',
      entityId: paperId,
      diff: { title: paper.title },
    });
  }

  private isPaperAuthor(
    userId: string,
    paper: { submittedById: string; authorships: { userId: string | null }[] },
  ) {
    return (
      paper.submittedById === userId || paper.authorships.some((author) => author.userId === userId)
    );
  }

  private coordinatorMayWithdraw(status: string) {
    return (
      status === 'SUBMITTED' ||
      status === 'UNDER_REVIEW' ||
      status === 'DECISION_MADE' ||
      status === 'CAMERA_READY'
    );
  }

  private async loadPaperForMutation(userId: string, conferenceId: string, paperId: string) {
    const paper = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.paper.findFirst({
        where: { id: paperId, conferenceId },
        include: paperInclude,
      }),
    );
    if (!paper) {
      throw new NotFoundException('Paper not found');
    }
    return paper;
  }

  private async assignSubmissionNumber(
    userId: string,
    paper: LoadedPaper,
    conferenceSlug: string,
  ): Promise<LoadedPaper> {
    const attempts = 5;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const submissionNumber = generateSubmissionNumber(conferenceSlug);
      try {
        const assigned = await withTenantContext(
          { userId, conferenceId: paper.conferenceId, organizationId: paper.organizationId },
          async (tx) => {
            const result = await tx.paper.updateMany({
              where: { id: paper.id, status: 'DRAFT', submissionNumber: null },
              data: {
                status: 'SUBMITTED',
                submissionNumber,
                version: { increment: 1 },
              },
            });
            if (result.count !== 1) {
              return null;
            }
            return tx.paper.findFirst({
              where: { id: paper.id },
              include: paperInclude,
            });
          },
        );

        if (!assigned) {
          throw new ConflictException('Paper has already been submitted');
        }
        return assigned;
      } catch (error) {
        const duplicate =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (duplicate && attempt < attempts - 1) {
          continue;
        }
        if (duplicate) {
          throw new ConflictException('Could not assign a unique submission number');
        }
        throw error;
      }
    }

    throw new ConflictException('Could not assign a unique submission number');
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

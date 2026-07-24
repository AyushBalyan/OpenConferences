import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RoleKind } from '@openconferences/db';
import { generateId, withTenantContext } from '@openconferences/db';
import type { AuthorshipInput, ReorderAuthorshipsInput } from '@openconferences/schemas';
import { PapersService } from './papers.service';
import { isPrivilegedReader, mapAuthorship } from './submission.mapper';

@Injectable()
export class AuthorshipsService {
  constructor(private readonly papers: PapersService) {}

  async add(
    userId: string,
    conferenceId: string,
    paperId: string,
    input: AuthorshipInput,
    roles: RoleKind[],
  ) {
    const paper = await this.papers.loadPaper(userId, conferenceId, paperId, roles);
    this.assertEditable(paper.status, userId, paper, roles);

    const maxOrder = paper.authorships.reduce((max, a) => Math.max(max, a.order), 0);

    try {
      const authorship = await withTenantContext(
        { userId, conferenceId, organizationId: paper.organizationId },
        async (tx) => {
          if (input.isCorresponding) {
            await tx.authorship.updateMany({
              where: { paperId, isCorresponding: true },
              data: { isCorresponding: false },
            });
          }

          return tx.authorship.create({
            data: {
              id: generateId(),
              paperId,
              userId: input.userId ?? null,
              order: maxOrder + 1,
              isCorresponding: input.isCorresponding,
              fullName: input.fullName,
              email: input.email,
              affiliation: input.affiliation ?? null,
            },
          });
        },
      );

      return mapAuthorship(authorship);
    } catch {
      throw new ConflictException('Could not add authorship (duplicate corresponding author?)');
    }
  }

  async reorder(
    userId: string,
    conferenceId: string,
    paperId: string,
    input: ReorderAuthorshipsInput,
    roles: RoleKind[],
  ) {
    const paper = await this.papers.loadPaper(userId, conferenceId, paperId, roles);
    this.assertEditable(paper.status, userId, paper, roles);

    const existingIds = new Set(paper.authorships.map((a) => a.id));
    if (
      input.authorshipIds.length !== paper.authorships.length ||
      !input.authorshipIds.every((id) => existingIds.has(id))
    ) {
      throw new BadRequestException('Authorship list mismatch');
    }

    const reordered = await withTenantContext(
      { userId, conferenceId, organizationId: paper.organizationId },
      async (tx) => {
        // Offset technique (§18.10): move to temporary high orders first
        const offset = 1000;
        for (let i = 0; i < input.authorshipIds.length; i++) {
          await tx.authorship.update({
            where: { id: input.authorshipIds[i] },
            data: { order: offset + i + 1 },
          });
        }

        for (let i = 0; i < input.authorshipIds.length; i++) {
          await tx.authorship.update({
            where: { id: input.authorshipIds[i] },
            data: { order: i + 1 },
          });
        }

        return tx.authorship.findMany({
          where: { paperId },
          orderBy: { order: 'asc' },
        });
      },
    );

    return reordered.map(mapAuthorship);
  }

  async remove(
    userId: string,
    conferenceId: string,
    paperId: string,
    authorshipId: string,
    roles: RoleKind[],
  ) {
    const paper = await this.papers.loadPaper(userId, conferenceId, paperId, roles);
    this.assertEditable(paper.status, userId, paper, roles);

    const authorship = paper.authorships.find((a) => a.id === authorshipId);
    if (!authorship) {
      throw new NotFoundException('Authorship not found');
    }

    if (paper.authorships.length <= 1) {
      throw new ConflictException('Cannot remove the last author');
    }

    await withTenantContext(
      { userId, conferenceId, organizationId: paper.organizationId },
      async (tx) => {
        await tx.authorship.delete({ where: { id: authorshipId } });

        const remaining = await tx.authorship.findMany({
          where: { paperId },
          orderBy: { order: 'asc' },
        });

        if (!remaining.some((a) => a.isCorresponding) && remaining[0]) {
          await tx.authorship.update({
            where: { id: remaining[0].id },
            data: { isCorresponding: true },
          });
        }

        for (let i = 0; i < remaining.length; i++) {
          await tx.authorship.update({
            where: { id: remaining[i]!.id },
            data: { order: i + 1 },
          });
        }
      },
    );
  }

  private assertEditable(
    status: string,
    userId: string,
    paper: { submittedById: string; authorships: { userId: string | null }[] },
    roles: RoleKind[],
  ) {
    if (status !== 'DRAFT') {
      throw new ConflictException('Authorships can only be edited on draft papers');
    }

    if (isPrivilegedReader(roles)) {
      return;
    }

    const isAuthor =
      paper.submittedById === userId || paper.authorships.some((a) => a.userId === userId);

    if (!isAuthor) {
      throw new ForbiddenException('Only paper authors can edit authorships');
    }
  }
}

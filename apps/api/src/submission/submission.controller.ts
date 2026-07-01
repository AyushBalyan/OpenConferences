import { Controller, UseGuards } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { submissionContract } from '@openconferences/contracts';
import type { RoleKind } from '@openconferences/db';
import { AuthGuard } from '../common/guards/auth.guard';
import { MembershipGuard } from '../common/guards/membership.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoleGrants } from '../common/decorators/role-grants.decorator';
import { RequireRole } from '../common/decorators/require-role.decorator';
import { RequireMembership } from '../common/decorators/require-membership.decorator';
import type { AuthUser } from '../auth/auth.types';
import { AuthorshipsService } from './authorships.service';
import { PapersService } from './papers.service';
import { VersionsService } from './versions.service';

@Controller()
@UseGuards(AuthGuard, MembershipGuard)
export class SubmissionController {
  constructor(
    private readonly papers: PapersService,
    private readonly authorships: AuthorshipsService,
    private readonly versions: VersionsService,
  ) {}

  @TsRestHandler(submissionContract.listPapers)
  @RequireMembership()
  listPapers(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(submissionContract.listPapers, async ({ params, query }) => {
      const result = await this.papers.list(user.id, params.conferenceId, roles, query);
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(submissionContract.createPaper)
  @RequireRole('AUTHOR')
  @RequireMembership()
  createPaper(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(submissionContract.createPaper, async ({ params, body }) => {
      const paper = await this.papers.create(user.id, params.conferenceId, body, roles);
      return { status: 201 as const, body: paper };
    });
  }

  @TsRestHandler(submissionContract.getPaper)
  @RequireMembership()
  getPaper(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(submissionContract.getPaper, async ({ params }) => {
      const paper = await this.papers.get(user.id, params.conferenceId, params.paperId, roles);
      return { status: 200 as const, body: paper };
    });
  }

  @TsRestHandler(submissionContract.updatePaper)
  @RequireMembership()
  updatePaper(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(submissionContract.updatePaper, async ({ params, body }) => {
      const paper = await this.papers.update(
        user.id,
        params.conferenceId,
        params.paperId,
        body,
        roles,
      );
      return { status: 200 as const, body: paper };
    });
  }

  @TsRestHandler(submissionContract.addAuthorship)
  @RequireMembership()
  addAuthorship(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(submissionContract.addAuthorship, async ({ params, body }) => {
      const authorship = await this.authorships.add(
        user.id,
        params.conferenceId,
        params.paperId,
        body,
        roles,
      );
      return { status: 201 as const, body: authorship };
    });
  }

  @TsRestHandler(submissionContract.reorderAuthorships)
  @RequireMembership()
  reorderAuthorships(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(submissionContract.reorderAuthorships, async ({ params, body }) => {
      const data = await this.authorships.reorder(
        user.id,
        params.conferenceId,
        params.paperId,
        body,
        roles,
      );
      return { status: 200 as const, body: { data } };
    });
  }

  @TsRestHandler(submissionContract.removeAuthorship)
  @RequireMembership()
  removeAuthorship(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(submissionContract.removeAuthorship, async ({ params }) => {
      await this.authorships.remove(
        user.id,
        params.conferenceId,
        params.paperId,
        params.authorshipId,
        roles,
      );
      return { status: 204 as const, body: undefined };
    });
  }

  @TsRestHandler(submissionContract.initiateVersion)
  @RequireMembership()
  initiateVersion(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(submissionContract.initiateVersion, async ({ params, body }) => {
      const result = await this.versions.initiate(
        user.id,
        params.conferenceId,
        params.paperId,
        body,
        roles,
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(submissionContract.completeVersion)
  @RequireMembership()
  completeVersion(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(submissionContract.completeVersion, async ({ params, body }) => {
      const version = await this.versions.complete(
        user.id,
        params.conferenceId,
        params.paperId,
        body,
        roles,
      );
      return { status: 201 as const, body: version };
    });
  }

  @TsRestHandler(submissionContract.submitPaper)
  @RequireMembership()
  submitPaper(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(submissionContract.submitPaper, async ({ params }) => {
      const paper = await this.papers.submit(user.id, params.conferenceId, params.paperId, roles);
      return {
        status: 200 as const,
        body: { paper, message: 'Paper submitted successfully' },
      };
    });
  }

  @TsRestHandler(submissionContract.downloadVersion)
  @RequireMembership()
  downloadVersion(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(submissionContract.downloadVersion, async ({ params }) => {
      const result = await this.versions.download(
        user.id,
        params.conferenceId,
        params.paperId,
        params.versionId,
        roles,
      );
      return { status: 200 as const, body: result };
    });
  }
}

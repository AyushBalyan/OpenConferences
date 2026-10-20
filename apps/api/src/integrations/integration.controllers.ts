import {
  Controller,
  UseGuards,
  UseInterceptors,
  Req,
  Res,
  UnauthorizedException,
  NotFoundException,
  ServiceUnavailableException,
  HttpException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import {
  integrationManagementContract as management,
  botReadContract as bot,
  botWriteContract,
} from '@openconferences/contracts';
import type {
  BotQuery,
  BotCreateAssignment,
  BotGenerateInvitations,
} from '@openconferences/schemas';
import type { RoleKind } from '@openconferences/db';
import { AuthGuard } from '../common/guards/auth.guard';
import { MembershipGuard } from '../common/guards/membership.guard';
import { RequireMembership } from '../common/decorators/require-membership.decorator';
import { RequireReviewCoordination } from '../common/decorators/require-review-coordination.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoleGrants } from '../common/decorators/role-grants.decorator';
import type { AuthUser } from '../auth/auth.types';
import { IntegrationStore } from './integration.store';
import { BotReadService } from './bot-read.service';
import { BotWriteService } from './bot-write.service';
import { BotInvitationsService } from './bot-invitations.service';
import { IntegrationLimiter } from './integration.limiter';
import { IntegrationNoStore } from './integration.http';
import { botConfig, parseCredential } from './integration.security';
@Controller()
@UseGuards(AuthGuard, MembershipGuard)
@UseInterceptors(IntegrationNoStore)
@RequireMembership()
@RequireReviewCoordination()
export class IntegrationManagementController {
  constructor(private readonly store: IntegrationStore) {}
  @TsRestHandler(management.list)
  list(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(management.list, async ({ params, query }) => ({
      status: 200,
      body: await this.store.list(
        await this.store.context(user.id, params.conferenceId, roles),
        query.limit,
        query.cursor,
      ),
    }));
  }
  @TsRestHandler(management.create)
  create(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(management.create, async ({ params, body }) => ({
      status: 201,
      body: await this.store.create(
        await this.store.context(user.id, params.conferenceId, roles),
        body,
      ),
    }));
  }
  @TsRestHandler(management.get)
  get(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(management.get, async ({ params }) => ({
      status: 200,
      body: await this.store.detail(
        await this.store.context(user.id, params.conferenceId, roles),
        params.integrationId,
      ),
    }));
  }
  @TsRestHandler(management.update)
  update(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(management.update, async ({ params, body }) => ({
      status: 200,
      body: await this.store.change(
        await this.store.context(user.id, params.conferenceId, roles),
        params.integrationId,
        body,
      ),
    }));
  }
  @TsRestHandler(management.revoke)
  revoke(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(management.revoke, async ({ params, body }) => ({
      status: 200,
      body: await this.store.change(
        await this.store.context(user.id, params.conferenceId, roles),
        params.integrationId,
        body,
        'revoked',
      ),
    }));
  }
  @TsRestHandler(management.reauthorize)
  reauthorize(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(management.reauthorize, async ({ params, body }) => ({
      status: 200,
      body: await this.store.change(
        await this.store.context(user.id, params.conferenceId, roles),
        params.integrationId,
        body,
        'reauthorized',
      ),
    }));
  }
  @TsRestHandler(management.issueKey)
  issue(
    @CurrentUser() user: AuthUser,
    @RoleGrants() roles: RoleKind[],
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return tsRestHandler(management.issueKey, async ({ params, body }) => ({
      status: 201,
      body: await this.store.issue(
        await this.store.context(user.id, params.conferenceId, roles),
        params.integrationId,
        body,
      ),
    }));
  }
  @TsRestHandler(management.revokeKey)
  revokeKey(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(management.revokeKey, async ({ params }) => ({
      status: 200,
      body: await this.store.revokeKey(
        await this.store.context(user.id, params.conferenceId, roles),
        params.integrationId,
        params.keyId,
      ),
    }));
  }
  @TsRestHandler(management.access)
  access(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(management.access, async ({ params, query }) => ({
      status: 200,
      body: await this.store.access(
        await this.store.context(user.id, params.conferenceId, roles),
        params.integrationId,
        query.limit,
        query.cursor,
      ),
    }));
  }
}
@Controller()
export class BotReadController {
  constructor(
    private readonly store: IntegrationStore,
    private readonly reads: BotReadService,
    private readonly limiter: IntegrationLimiter,
    private readonly writes: BotWriteService,
    private readonly invitations: BotInvitationsService,
  ) {}
  private async run(
    req: Request,
    res: Response,
    conferenceId: string,
    resource: string,
    q: BotQuery | undefined,
    id?: string,
    mutation?:
      BotCreateAssignment | BotGenerateInvitations | { requestId: string; invitationId: string },
  ) {
    res.setHeader('Cache-Control', 'no-store');
    botConfig();
    try {
      await this.limiter.preauth(req.ip ?? 'unknown');
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === 429)
        res.setHeader('Retry-After', '60');
      throw error;
    }
    const candidate = parseCredential(req.headers.authorization);
    if (!candidate) throw new UnauthorizedException('Invalid API credential');
    let p;
    try {
      p = await this.store.authenticate(candidate);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Bot authentication is temporarily unavailable');
    }
    const requestId = randomUUID(),
      start = performance.now();
    let release: (() => Promise<void>) | undefined;
    const method = mutation ? ('invitationId' in mutation ? 'DELETE' : 'POST') : 'GET';
    const routeTemplate =
      resource === 'invitation-link'
        ? '/integrations/v1/conferences/:conferenceId/reviewer-invitations/:invitationId/link'
        : `/integrations/v1/conferences/:conferenceId/${resource}${id ? (resource === 'reviewer-invitations' ? '/:invitationId' : '/:id') : ''}`;
    try {
      if (p.conferenceId !== conferenceId) throw new NotFoundException('Resource not found');
      release = await this.limiter.acquire(p);
      const data = mutation
        ? 'paperId' in mutation
          ? await this.writes.assign(p, mutation, requestId, start)
          : 'emails' in mutation
            ? await this.invitations.generate(p, mutation, requestId, start)
            : await this.invitations.remove(
                p,
                mutation.invitationId,
                mutation.requestId,
                requestId,
                start,
              )
        : resource === 'capabilities'
          ? this.reads.capabilities(p)
          : resource === 'papers'
            ? await this.reads.papers(p, q!, id)
            : resource === 'authors'
              ? await this.reads.authors(p, q!, id)
              : resource === 'reviewers'
                ? await this.reads.reviewers(p, q!, id)
                : resource === 'reviewer-invitations'
                  ? await this.reads.reviewerInvitations(p, q!)
                  : resource === 'invitation-link'
                    ? await this.invitations.link(p, id!)
                    : resource === 'assignments'
                      ? await this.reads.assignments(p, q!, id)
                      : await this.reads.summary(p, q!);
      if (!mutation)
        await this.store.record(
          p,
          requestId,
          routeTemplate,
          200,
          'data' in data ? (Array.isArray(data.data) ? data.data.length : 1) : 1,
          performance.now() - start,
        );
      return data;
    } catch (error) {
      const status = error instanceof HttpException ? error.getStatus() : 503;
      if (status === 429) res.setHeader('Retry-After', '60');
      try {
        await this.store.record(
          p,
          requestId,
          routeTemplate,
          status,
          0,
          performance.now() - start,
          method,
        );
      } catch {
        throw new ServiceUnavailableException('Bot access logging is temporarily unavailable');
      }
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Bot data is temporarily unavailable');
    } finally {
      await release?.();
    }
  }
  @TsRestHandler(bot.capabilities, { validateResponses: true })
  capabilities(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return tsRestHandler(bot.capabilities, async ({ params }) => ({
      status: 200 as const,
      body: (await this.run(req, res, params.conferenceId, 'capabilities', undefined)) as never,
    }));
  }
  @TsRestHandler(bot.papers, { validateResponses: true })
  papers(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return tsRestHandler(bot.papers, async ({ params, query }) => ({
      status: 200 as const,
      body: (await this.run(req, res, params.conferenceId, 'papers', query)) as never,
    }));
  }
  @TsRestHandler(bot.paper, { validateResponses: true })
  paper(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return tsRestHandler(bot.paper, async ({ params, query }) => ({
      status: 200 as const,
      body: (await this.run(
        req,
        res,
        params.conferenceId,
        'papers',
        query,
        params.paperId,
      )) as never,
    }));
  }
  @TsRestHandler(bot.authors, { validateResponses: true })
  authors(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return tsRestHandler(bot.authors, async ({ params, query }) => ({
      status: 200 as const,
      body: (await this.run(req, res, params.conferenceId, 'authors', query)) as never,
    }));
  }
  @TsRestHandler(bot.paperAuthors, { validateResponses: true })
  paperAuthors(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return tsRestHandler(bot.paperAuthors, async ({ params, query }) => ({
      status: 200 as const,
      body: (await this.run(
        req,
        res,
        params.conferenceId,
        'authors',
        { ...query, paperId: params.paperId },
        params.paperId,
      )) as never,
    }));
  }
  @TsRestHandler(bot.reviewers, { validateResponses: true })
  reviewers(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return tsRestHandler(bot.reviewers, async ({ params, query }) => ({
      status: 200 as const,
      body: (await this.run(req, res, params.conferenceId, 'reviewers', query)) as never,
    }));
  }
  @TsRestHandler(bot.reviewerInvitations, { validateResponses: true })
  reviewerInvitations(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return tsRestHandler(bot.reviewerInvitations, async ({ params, query }) => ({
      status: 200 as const,
      body: (await this.run(req, res, params.conferenceId, 'reviewer-invitations', query)) as never,
    }));
  }
  @TsRestHandler(botWriteContract.createAssignment, { validateResponses: true })
  createAssignment(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return tsRestHandler(botWriteContract.createAssignment, async ({ params, body }) => ({
      status: 201 as const,
      body: (await this.run(
        req,
        res,
        params.conferenceId,
        'assignments',
        undefined,
        undefined,
        body,
      )) as never,
    }));
  }
  @TsRestHandler(bot.invitationLink, { validateResponses: true })
  invitationLink(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return tsRestHandler(bot.invitationLink, async ({ params }) => ({
      status: 200 as const,
      body: (await this.run(
        req,
        res,
        params.conferenceId,
        'invitation-link',
        undefined,
        params.invitationId,
      )) as never,
    }));
  }
  @TsRestHandler(botWriteContract.generateInvitations, { validateResponses: true })
  generateInvitations(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return tsRestHandler(botWriteContract.generateInvitations, async ({ params, body }) => ({
      status: 201 as const,
      body: (await this.run(
        req,
        res,
        params.conferenceId,
        'reviewer-invitations',
        undefined,
        undefined,
        body,
      )) as never,
    }));
  }
  @TsRestHandler(botWriteContract.removeInvitation, { validateResponses: true })
  removeInvitation(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return tsRestHandler(botWriteContract.removeInvitation, async ({ params, body }) => ({
      status: 200 as const,
      body: (await this.run(
        req,
        res,
        params.conferenceId,
        'reviewer-invitations',
        undefined,
        params.invitationId,
        { ...body, invitationId: params.invitationId },
      )) as never,
    }));
  }
  @TsRestHandler(bot.reviewer, { validateResponses: true })
  reviewer(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return tsRestHandler(bot.reviewer, async ({ params, query }) => ({
      status: 200 as const,
      body: (await this.run(
        req,
        res,
        params.conferenceId,
        'reviewers',
        query,
        params.reviewerId,
      )) as never,
    }));
  }
  @TsRestHandler(bot.assignments, { validateResponses: true })
  assignments(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return tsRestHandler(bot.assignments, async ({ params, query }) => ({
      status: 200 as const,
      body: (await this.run(req, res, params.conferenceId, 'assignments', query)) as never,
    }));
  }
  @TsRestHandler(bot.assignment, { validateResponses: true })
  assignment(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return tsRestHandler(bot.assignment, async ({ params, query }) => ({
      status: 200 as const,
      body: (await this.run(
        req,
        res,
        params.conferenceId,
        'assignments',
        query,
        params.assignmentId,
      )) as never,
    }));
  }
  @TsRestHandler(bot.summary, { validateResponses: true })
  summary(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return tsRestHandler(bot.summary, async ({ params, query }) => ({
      status: 200 as const,
      body: (await this.run(req, res, params.conferenceId, 'summary', query)) as never,
    }));
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Req,
  Res,
  HttpCode,
  HttpException,
  NotFoundException,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  invitationOperationSchema,
  invitationOperationsQuerySchema,
  bulkInvitationInputSchema,
  botAssignmentInterventionSchema,
  invitationLifetimeSchema,
} from '@openconferences/schemas';
import { randomUUID } from 'node:crypto';
import { IntegrationStore, type IntegrationAudit } from './integration.store';
import { IntegrationLimiter } from './integration.limiter';
import { botConfig, parseCredential, type IntegrationPrincipal } from './integration.security';
import { InvitationOperationsService } from './invitation-operations.service';
import { InvitationBatchService } from './invitation-batch.service';
import { BotWriteService } from './bot-write.service';
import { ReviewerCoverageService } from './reviewer-coverage.service';
function input<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new BadRequestException(
      parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
    );
  return parsed.data;
}
@Controller('integrations/v1/conferences/:conferenceId/reviewer-operations')
export class ReviewerOperationsController {
  constructor(
    private readonly store: IntegrationStore,
    private readonly limiter: IntegrationLimiter,
    private readonly invitations: InvitationOperationsService,
    private readonly batches: InvitationBatchService,
    private readonly writes: BotWriteService,
    private readonly coverage: ReviewerCoverageService,
  ) {}
  private async run(
    req: Request,
    res: Response,
    conferenceId: string,
    resource: string,
    fn: (p: IntegrationPrincipal, recordAccess: IntegrationAudit) => Promise<unknown>,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    botConfig();
    try {
      await this.limiter.preauth(req.ip ?? 'unknown');
    } catch (e) {
      if (e instanceof HttpException && e.getStatus() === 429) res.setHeader('Retry-After', '60');
      throw e;
    }
    const credential = parseCredential(req.headers.authorization);
    if (!credential) throw new UnauthorizedException('Invalid API credential');
    const p = await this.store.authenticate(credential);
    if (p.conferenceId !== conferenceId) throw new NotFoundException('Resource not found');
    let release: (() => Promise<void>) | undefined;
    const id = randomUUID(),
      started = performance.now();
    try {
      release = await this.limiter.acquire(p);
      if (resource.startsWith('invitation-batches'))
        await this.limiter.reviewerOperation(
          p,
          req.method === 'POST' ? 'submit' : resource.endsWith('/results') ? 'results' : 'progress',
        );
      let recordedInTransaction = false;
      const recordAccess: IntegrationAudit = async (tx) => {
        await this.store.recordInTransaction(
          tx,
          p,
          resource === 'invitation-extensions' ? randomUUID() : id,
          `/integrations/v1/conferences/:conferenceId/reviewer-operations/${resource}`,
          req.method === 'POST' && resource === 'invitation-batches' ? 202 : 200,
          1,
          performance.now() - started,
          req.method,
        );
        recordedInTransaction = true;
      };
      const result = await fn(p, recordAccess);
      if (!recordedInTransaction)
        await this.store.record(
          p,
          id,
          `/integrations/v1/conferences/:conferenceId/reviewer-operations/${resource}`,
          req.method === 'POST' && resource === 'invitation-batches' ? 202 : 200,
          1,
          performance.now() - started,
          req.method,
        );
      return result;
    } catch (e) {
      const status = e instanceof HttpException ? e.getStatus() : 503;
      if (status === 429) res.setHeader('Retry-After', '60');
      try {
        await this.store.record(
          p,
          id,
          `/integrations/v1/conferences/:conferenceId/reviewer-operations/${resource}`,
          status,
          0,
          performance.now() - started,
          req.method,
        );
      } catch {
        throw new ServiceUnavailableException(
          'Reviewer operation auditing is temporarily unavailable',
        );
      }
      if (!(e instanceof HttpException))
        throw new ServiceUnavailableException('Reviewer operations are temporarily unavailable');
      throw e;
    } finally {
      await release?.();
    }
  }
  @Get('invitations')
  list(
    @Param('conferenceId') conferenceId: string,
    @Query() query: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.run(req, res, conferenceId, 'invitations', (p) =>
      this.invitations.list(p, input(invitationOperationsQuerySchema, query)),
    );
  }
  @Get('invitation-changes')
  changes(
    @Param('conferenceId') conferenceId: string,
    @Query() query: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.run(req, res, conferenceId, 'invitation-changes', (p) =>
      this.invitations.changes(
        p,
        input(invitationOperationsQuerySchema.pick({ limit: true, cursor: true }).strict(), query),
      ),
    );
  }
  @Post('invitations/:id/actions')
  @HttpCode(200)
  operate(
    @Param('conferenceId') conferenceId: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.run(req, res, conferenceId, 'invitations/:id/actions', (p, recordAccess) =>
      this.invitations.operate(
        p,
        input(z.string().uuid(), id),
        input(invitationOperationSchema, body),
        recordAccess,
      ),
    );
  }
  @Post('invitation-extensions')
  @HttpCode(200)
  extendMany(
    @Param('conferenceId') conferenceId: string,
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.run(req, res, conferenceId, 'invitation-extensions', async (p, recordAccess) => {
      const entries = input(
        z
          .object({
            operations: z
              .array(
                invitationOperationSchema.extend({
                  invitationId: z.string().uuid(),
                  action: z.literal('EXTEND'),
                }),
              )
              .min(1)
              .max(100),
          })
          .strict(),
        body,
      ).operations;
      const data = [];
      // Keep the whole request below the limiter's 60-second admission lease.
      // One final 10-second row transaction can finish after this checkpoint.
      const deadline = performance.now() + 30000;
      for (const { invitationId, ...operation } of entries) {
        if (performance.now() >= deadline) {
          data.push({
            invitationId,
            success: false,
            status: 503,
            message: 'Batch time limit reached; retry with the same row request IDs.',
          });
          continue;
        }
        try {
          const result = await this.invitations.operate(p, invitationId, operation, recordAccess);
          data.push({ invitationId, success: true, invitation: result.invitation });
        } catch (error) {
          if (!(error instanceof HttpException)) throw error;
          data.push({
            invitationId,
            success: false,
            status: error.getStatus(),
            message: error.message,
          });
        }
      }
      return { data };
    });
  }
  @Post('invitation-batches')
  @HttpCode(202)
  batch(
    @Param('conferenceId') conferenceId: string,
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.run(req, res, conferenceId, 'invitation-batches', (p, recordAccess) =>
      this.batches.submit(p, input(bulkInvitationInputSchema, body), recordAccess),
    );
  }
  @Get('invitation-batches/:id')
  batchStatus(
    @Param('conferenceId') conferenceId: string,
    @Param('id') id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.run(req, res, conferenceId, 'invitation-batches/:id', (p) =>
      this.batches.status(p, input(z.string().uuid(), id)),
    );
  }
  @Get('invitation-batches/:id/results')
  results(
    @Param('conferenceId') conferenceId: string,
    @Param('id') id: string,
    @Query() query: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.run(req, res, conferenceId, 'invitation-batches/:id/results', (p) =>
      this.batches.results(
        p,
        input(z.string().uuid(), id),
        input(
          z
            .object({
              offset: z.coerce.number().int().min(0).default(0),
              limit: z.coerce.number().int().min(1).max(100).default(25),
            })
            .strict(),
          query,
        ),
      ),
    );
  }
  @Post('assignments/:id/actions')
  @HttpCode(200)
  assignment(
    @Param('conferenceId') conferenceId: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.run(req, res, conferenceId, 'assignments/:id/actions', (p, recordAccess) =>
      this.writes.intervene(
        p,
        input(z.string().uuid(), id),
        input(botAssignmentInterventionSchema, body),
        recordAccess,
      ),
    );
  }
  @Get('coverage')
  summary(
    @Param('conferenceId') conferenceId: string,
    @Query() query: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.run(req, res, conferenceId, 'coverage', (p) =>
      this.coverage.summary(
        p,
        input(
          z
            .object({
              cursor: z.string().uuid().optional(),
              limit: z.coerce.number().int().min(1).max(100).default(25),
            })
            .strict(),
          query,
        ),
      ),
    );
  }
  @Patch('invitation-settings')
  @HttpCode(200)
  settings(
    @Param('conferenceId') conferenceId: string,
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.run(req, res, conferenceId, 'invitation-settings', (p, recordAccess) =>
      this.invitations.settings(
        p,
        input(z.object({ lifetimeDays: invitationLifetimeSchema }).strict(), body).lifetimeDays,
        recordAccess,
      ),
    );
  }
}

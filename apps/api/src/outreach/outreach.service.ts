import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { getConfig } from '@openconferences/config/env';
import type { OutreachCampaign, OutreachRecipientStatus, RoleKind } from '@openconferences/db';
import { generateId, withTenantContext } from '@openconferences/db';
import type {
  CreateOutreachCampaignInput,
  ImportOutreachRecipientsInput,
  OutreachCampaignDto,
  OutreachCampaignListDto,
  OutreachPreviewDto,
  OutreachRecipientListDto,
  OutreachSenderDto,
  OutreachTemplateDto,
  SelectOutreachTemplateInput,
  SendOutreachCampaignInput,
} from '@openconferences/schemas';
import { AuditService } from '../audit/audit.service';
import { paginateItems, prismaCursorArgs, resolveLimit } from '../common/pagination/cursor';
import { QueueService } from '../queue/queue.service';
import { ConferenceService } from '../tenancy/conference.service';
import { mapOutreachCampaign, mapOutreachRecipient, mapOutreachTemplate } from './outreach.mapper';
import { validateRecipientRows } from './recipient-import';
import { renderOutreachTemplate } from './template-renderer';

const EDITABLE_STATUSES = new Set(['DRAFT', 'READY']);
const TERMINAL_SEND_STATUSES = new Set(['SENDING', 'SENT', 'PARTIAL', 'FAILED']);

@Injectable()
export class OutreachService {
  constructor(
    private readonly conferences: ConferenceService,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
  ) {}

  private senderFromEnv(): OutreachSenderDto {
    const { outreach } = getConfig();
    return {
      fromName: outreach.fromName,
      fromEmail: outreach.fromEmail,
      replyToEmail: outreach.replyToEmail,
      configured: Boolean(outreach.fromEmail),
      provider: outreach.provider,
    };
  }

  getSender(userId: string, conferenceId: string, roles: RoleKind[]): Promise<OutreachSenderDto> {
    return this.conferences
      .loadConference(userId, conferenceId, roles)
      .then(() => this.senderFromEnv());
  }

  async listTemplates(
    userId: string,
    conferenceId: string,
    roles: RoleKind[],
  ): Promise<{ data: OutreachTemplateDto[] }> {
    await this.conferences.loadConference(userId, conferenceId, roles);
    const templates = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.outreachTemplate.findMany({
        where: {
          isActive: true,
          OR: [{ conferenceId: null, organizationId: null }, { conferenceId }],
        },
        orderBy: [{ name: 'asc' }, { version: 'desc' }],
      }),
    );

    const latestByKey = new Map<string, (typeof templates)[number]>();
    for (const template of templates) {
      if (!latestByKey.has(template.key)) {
        latestByKey.set(template.key, template);
      }
    }

    return { data: [...latestByKey.values()].map(mapOutreachTemplate) };
  }

  async listCampaigns(
    userId: string,
    conferenceId: string,
    roles: RoleKind[],
    query: {
      cursor?: string;
      limit?: number;
      status?: OutreachCampaign['status'];
      type?: OutreachCampaign['type'];
    },
  ): Promise<OutreachCampaignListDto> {
    await this.conferences.loadConference(userId, conferenceId, roles);
    const limit = resolveLimit(query.limit);
    const rows = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.outreachCampaign.findMany({
        where: {
          conferenceId,
          ...(query.status ? { status: query.status } : {}),
          ...(query.type ? { type: query.type } : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...prismaCursorArgs({ cursor: query.cursor, limit: query.limit }, limit),
      }),
    );

    const page = paginateItems(rows, limit, (row) => row.id);
    return { data: page.data.map(mapOutreachCampaign), nextCursor: page.nextCursor };
  }

  async createCampaign(
    userId: string,
    conferenceId: string,
    roles: RoleKind[],
    input: CreateOutreachCampaignInput,
  ): Promise<OutreachCampaignDto> {
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const id = generateId();

    const campaign = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.outreachCampaign.create({
          data: {
            id,
            organizationId: conference.organizationId,
            conferenceId,
            createdById: userId,
            name: input.name,
            type: input.type,
            status: 'DRAFT',
          },
        }),
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'outreach.campaign.create',
      entity: 'OutreachCampaign',
      entityId: campaign.id,
      diff: { name: input.name, type: input.type },
    });

    return mapOutreachCampaign(campaign);
  }

  async getCampaign(
    userId: string,
    conferenceId: string,
    campaignId: string,
    roles: RoleKind[],
  ): Promise<OutreachCampaignDto> {
    const campaign = await this.loadCampaign(userId, conferenceId, campaignId, roles);
    return mapOutreachCampaign(campaign);
  }

  async importRecipients(
    userId: string,
    conferenceId: string,
    campaignId: string,
    roles: RoleKind[],
    input: ImportOutreachRecipientsInput,
  ) {
    const existing = await this.loadCampaign(userId, conferenceId, campaignId, roles);
    if (!EDITABLE_STATUSES.has(existing.status)) {
      throw new ConflictException('Recipients can only be imported while the campaign is a draft');
    }

    const parsed = validateRecipientRows(input.rows);
    const campaign = await withTenantContext(
      { userId, conferenceId, organizationId: existing.organizationId },
      async (tx) => {
        await tx.outreachRecipient.deleteMany({ where: { campaignId } });
        if (parsed.valid.length > 0) {
          await tx.outreachRecipient.createMany({
            data: parsed.valid.map((row) => ({
              id: generateId(),
              organizationId: existing.organizationId,
              conferenceId,
              campaignId,
              name: row.name,
              email: row.email,
              topic: row.topic,
              paper: row.paper,
              status: 'PENDING' as const,
            })),
          });
        }

        const nextStatus = parsed.valid.length > 0 && existing.templateId ? 'READY' : 'DRAFT';
        return tx.outreachCampaign.update({
          where: { id: campaignId },
          data: {
            recipientCount: parsed.valid.length,
            sentCount: 0,
            failedCount: 0,
            skippedCount: 0,
            status: nextStatus,
            version: { increment: 1 },
          },
        });
      },
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: existing.organizationId,
      conferenceId,
      action: 'outreach.campaign.import',
      entity: 'OutreachCampaign',
      entityId: campaignId,
      diff: {
        importedCount: parsed.valid.length,
        invalidCount: parsed.invalidRows.length,
        duplicateCount: parsed.duplicateCount,
      },
    });

    return {
      campaign: mapOutreachCampaign(campaign),
      importedCount: parsed.valid.length,
      duplicateCount: parsed.duplicateCount,
      invalidRows: parsed.invalidRows,
    };
  }

  async listRecipients(
    userId: string,
    conferenceId: string,
    campaignId: string,
    roles: RoleKind[],
    query: { cursor?: string; limit?: number; status?: OutreachRecipientStatus },
  ): Promise<OutreachRecipientListDto> {
    await this.loadCampaign(userId, conferenceId, campaignId, roles);
    const limit = resolveLimit(query.limit);
    const rows = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.outreachRecipient.findMany({
        where: {
          campaignId,
          conferenceId,
          ...(query.status ? { status: query.status } : {}),
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        ...prismaCursorArgs({ cursor: query.cursor, limit: query.limit }, limit),
      }),
    );
    const page = paginateItems(rows, limit, (row) => row.id);
    return { data: page.data.map(mapOutreachRecipient), nextCursor: page.nextCursor };
  }

  async selectTemplate(
    userId: string,
    conferenceId: string,
    campaignId: string,
    roles: RoleKind[],
    input: SelectOutreachTemplateInput,
  ): Promise<OutreachCampaignDto> {
    const existing = await this.loadCampaign(userId, conferenceId, campaignId, roles);
    if (!EDITABLE_STATUSES.has(existing.status)) {
      throw new ConflictException('Template can only be changed before sending');
    }

    const template = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.outreachTemplate.findFirst({
        where: {
          id: input.templateId,
          isActive: true,
          OR: [{ conferenceId: null, organizationId: null }, { conferenceId }],
        },
      }),
    );

    if (!template) {
      throw new NotFoundException('Outreach template not found');
    }

    const campaign = await withTenantContext(
      { userId, conferenceId, organizationId: existing.organizationId },
      async (tx) =>
        tx.outreachCampaign.update({
          where: { id: campaignId },
          data: {
            templateId: template.id,
            templateKey: template.key,
            templateName: template.name,
            subject: template.subject,
            bodyHtml: template.bodyHtml,
            status: existing.recipientCount > 0 ? 'READY' : 'DRAFT',
            version: { increment: 1 },
          },
        }),
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: existing.organizationId,
      conferenceId,
      action: 'outreach.campaign.select_template',
      entity: 'OutreachCampaign',
      entityId: campaignId,
      diff: { templateKey: template.key },
    });

    return mapOutreachCampaign(campaign);
  }

  async previewCampaign(
    userId: string,
    conferenceId: string,
    campaignId: string,
    roles: RoleKind[],
    recipientId?: string,
  ): Promise<OutreachPreviewDto> {
    const campaign = await this.loadCampaign(userId, conferenceId, campaignId, roles);
    if (!campaign.subject || !campaign.bodyHtml) {
      throw new BadRequestException('Select a template before previewing');
    }

    const recipient = await withTenantContext({ userId, conferenceId }, async (tx) => {
      if (recipientId) {
        return tx.outreachRecipient.findFirst({
          where: { id: recipientId, campaignId, conferenceId },
        });
      }
      return tx.outreachRecipient.findFirst({
        where: { campaignId, conferenceId },
        orderBy: { createdAt: 'asc' },
      });
    });

    if (recipientId && !recipient) {
      throw new NotFoundException('Recipient not found');
    }

    const sender = this.senderFromEnv();
    const context = {
      name: recipient?.name ?? '{{name}}',
      topic: recipient?.topic ?? '{{topic}}',
      paper: recipient?.paper ?? '{{paper}}',
    };

    return {
      recipientId: recipient?.id ?? null,
      recipientName: recipient?.name ?? null,
      recipientEmail: recipient?.email ?? null,
      subject: renderOutreachTemplate(campaign.subject, context),
      bodyHtml: renderOutreachTemplate(campaign.bodyHtml, context),
      fromName: sender.fromName,
      fromEmail: sender.fromEmail,
      replyToEmail: sender.replyToEmail,
    };
  }

  async sendCampaign(
    userId: string,
    conferenceId: string,
    campaignId: string,
    roles: RoleKind[],
    input: SendOutreachCampaignInput,
  ) {
    const existing = await this.loadCampaign(userId, conferenceId, campaignId, roles);

    if (existing.version !== input.version) {
      throw new ConflictException('Campaign was updated. Reload and confirm again.');
    }

    if (TERMINAL_SEND_STATUSES.has(existing.status) && existing.status !== 'FAILED') {
      return {
        campaign: mapOutreachCampaign(existing),
        message: 'Campaign send already in progress or completed',
      };
    }

    if (existing.recipientCount < 1) {
      throw new UnprocessableEntityException('Add at least one valid recipient before sending');
    }
    if (!existing.subject || !existing.bodyHtml || !existing.templateId) {
      throw new UnprocessableEntityException('Select a template before sending');
    }

    const sender = this.senderFromEnv();
    const now = new Date();

    const campaign = await withTenantContext(
      { userId, conferenceId, organizationId: existing.organizationId },
      async (tx) => {
        const updated = await tx.outreachCampaign.updateMany({
          where: {
            id: campaignId,
            conferenceId,
            version: input.version,
            status: { in: ['DRAFT', 'READY', 'FAILED'] },
          },
          data: {
            status: 'SENDING',
            fromName: sender.fromName,
            fromEmail: sender.fromEmail,
            replyToEmail: sender.replyToEmail,
            confirmedAt: now,
            version: { increment: 1 },
          },
        });

        if (updated.count !== 1) {
          throw new ConflictException('Campaign send could not be confirmed');
        }

        return tx.outreachCampaign.findFirstOrThrow({ where: { id: campaignId } });
      },
    );

    try {
      await this.queue.enqueueOutreachSend({
        campaignId,
        conferenceId,
        organizationId: existing.organizationId,
      });
    } catch (error) {
      await withTenantContext(
        { userId, conferenceId, organizationId: existing.organizationId },
        async (tx) =>
          tx.outreachCampaign.update({
            where: { id: campaignId },
            data: { status: 'FAILED', version: { increment: 1 } },
          }),
      );
      throw error;
    }

    await this.audit.log({
      actorUserId: userId,
      organizationId: existing.organizationId,
      conferenceId,
      action: 'outreach.campaign.send',
      entity: 'OutreachCampaign',
      entityId: campaignId,
      diff: {
        recipientCount: campaign.recipientCount,
        fromEmail: sender.fromEmail,
        replyToEmail: sender.replyToEmail,
      },
    });

    return {
      campaign: mapOutreachCampaign(campaign),
      message: 'Campaign queued for sending',
    };
  }

  private async loadCampaign(
    userId: string,
    conferenceId: string,
    campaignId: string,
    roles: RoleKind[],
  ): Promise<OutreachCampaign> {
    await this.conferences.loadConference(userId, conferenceId, roles);
    const campaign = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.outreachCampaign.findFirst({
        where: { id: campaignId, conferenceId },
      }),
    );
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    return campaign;
  }
}

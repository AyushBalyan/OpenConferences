import { Controller, Headers, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { OutreachWebhookService } from './outreach-webhook.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

@Controller()
export class OutreachWebhookController {
  constructor(private readonly webhooks: OutreachWebhookService) {}

  @Post('webhooks/resend/outreach')
  async resendOutreachWebhook(
    @Req() req: RawBodyRequest,
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
  ) {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    return this.webhooks.handleResendWebhook(rawBody, {
      svixId: svixId ?? '',
      svixTimestamp: svixTimestamp ?? '',
      svixSignature: svixSignature ?? '',
    });
  }
}

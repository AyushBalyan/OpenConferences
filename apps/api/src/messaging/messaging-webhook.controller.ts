import { Controller, Headers, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { MessagingWebhookService } from './messaging-webhook.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

@Controller()
export class MessagingWebhookController {
  constructor(private readonly webhooks: MessagingWebhookService) {}

  @Post('webhooks/zeptomail')
  async zeptomailWebhook(
    @Req() req: RawBodyRequest,
    @Headers('x-zepto-signature') signature: string,
  ) {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    return this.webhooks.handleZeptoWebhook(rawBody, signature ?? '');
  }
}

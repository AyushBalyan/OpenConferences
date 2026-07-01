import { Controller, Headers, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

@Controller()
export class WebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('webhooks/razorpay')
  async razorpayWebhook(
    @Req() req: RawBodyRequest,
    @Headers('x-razorpay-signature') signature: string,
    @Headers('x-razorpay-event-timestamp') timestamp?: string,
  ) {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    const result = await this.payments.handleWebhook(rawBody, signature ?? '', timestamp);
    return result;
  }
}

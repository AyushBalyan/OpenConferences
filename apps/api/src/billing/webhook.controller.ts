import {
  Controller,
  Headers,
  Post,
  Req,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { getConfig } from '@openconferences/config/env';
import { verifyReconciliationRequest } from './reconciliation-auth';
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
  @Post('internal/billing/reconcile')
  async reconcile(
    @Req() req: RawBodyRequest,
    @Headers('x-reconcile-signature') signature = '',
    @Headers('x-reconcile-timestamp') timestamp = '',
  ) {
    const body = req.rawBody;
    if (!body || !verifyReconciliationRequest(body, signature, timestamp, getConfig().auth.secret))
      throw new ForbiddenException('Invalid reconciliation signature');
    const input = req.body as { paymentId?: string };
    if (input.paymentId && !/^[a-f0-9-]{36}$/i.test(input.paymentId))
      throw new BadRequestException('Invalid payment ID');
    return this.payments.runReconciliation(input.paymentId);
  }
}

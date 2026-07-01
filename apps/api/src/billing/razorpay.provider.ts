import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { getConfig } from '@openconferences/config/env';
import type {
  CreateOrderInput,
  CreateOrderResult,
  ParsedWebhookEvent,
  PaymentProvider,
  RefundInput,
  RefundResult,
} from './payment-provider.interface';

type RazorpayOrderResponse = {
  id: string;
  amount: number;
  currency: string;
};

type RazorpayWebhookPayload = {
  event: string;
  payload?: {
    payment?: {
      entity?: {
        id: string;
        order_id: string;
        amount: number;
        currency: string;
        status: string;
        created_at: number;
      };
    };
  };
};

@Injectable()
export class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay';
  private readonly logger = new Logger(RazorpayProvider.name);

  private get credentials() {
    const config = getConfig();
    const keyId = config.razorpay.keyId;
    const keySecret = config.razorpay.keySecret;
    if (!keyId || !keySecret) {
      throw new Error('Razorpay credentials are not configured');
    }
    return { keyId, keySecret, webhookSecret: config.razorpay.webhookSecret };
  }

  getKeyId(): string {
    return this.credentials.keyId;
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const { keyId, keySecret } = this.credentials;
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: input.amountMinor,
        currency: input.currency,
        receipt: input.receipt,
        notes: input.notes ?? {},
        payment_capture: 1,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error({ status: response.status, body }, 'Razorpay order creation failed');
      throw new Error(`Razorpay order creation failed: ${response.status}`);
    }

    const data = (await response.json()) as RazorpayOrderResponse;
    return {
      orderId: data.id,
      amountMinor: data.amount,
      currency: data.currency,
      raw: data,
    };
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string, timestamp?: string): boolean {
    const { webhookSecret } = this.credentials;
    if (!webhookSecret) {
      return false;
    }

    const config = getConfig();
    if (timestamp) {
      const ts = Number.parseInt(timestamp, 10);
      if (!Number.isFinite(ts)) {
        return false;
      }
      const ageSeconds = Math.abs(Date.now() / 1000 - ts);
      if (ageSeconds > config.billing.webhookReplayWindowSeconds) {
        return false;
      }
    }

    const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  parseWebhook(payload: unknown): ParsedWebhookEvent | null {
    const data = payload as RazorpayWebhookPayload;
    if (data.event !== 'payment.captured') {
      return null;
    }

    const entity = data.payload?.payment?.entity;
    if (!entity?.id || !entity.order_id) {
      return null;
    }

    return {
      eventType: data.event,
      orderId: entity.order_id,
      paymentId: entity.id,
      amountMinor: entity.amount,
      currency: entity.currency,
      capturedAt: new Date(entity.created_at * 1000),
      raw: payload,
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const { keyId, keySecret } = this.credentials;
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const response = await fetch(`https://api.razorpay.com/v1/payments/${input.paymentId}/refund`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: input.amountMinor,
        notes: input.notes ?? {},
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error({ status: response.status, body }, 'Razorpay refund failed');
      throw new Error(`Razorpay refund failed: ${response.status}`);
    }

    const data = (await response.json()) as { id: string; amount: number };
    return {
      refundId: data.id,
      amountMinor: data.amount,
      raw: data,
    };
  }
}

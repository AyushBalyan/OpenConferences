import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  BadGatewayException,
  ServiceUnavailableException,
  Injectable,
  Logger,
} from '@nestjs/common';
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
      throw new ServiceUnavailableException(
        'Online payments are not configured. Please contact the organizers.',
      );
    }
    return { keyId, keySecret, webhookSecret: config.razorpay.webhookSecret };
  }

  getKeyId(): string {
    return this.credentials.keyId;
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 100) {
      throw new BadRequestException('Payment amount must be at least 100 minor currency units');
    }
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
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      this.logger.error({ status: response.status }, 'Razorpay order creation failed');
      throw new BadGatewayException(
        'Unable to start payment. Please try again or contact the organizers.',
      );
    }

    const data = (await response.json()) as RazorpayOrderResponse;
    if (!data.id || data.amount !== input.amountMinor || data.currency !== input.currency) {
      throw new BadGatewayException('Payment provider returned an unexpected order');
    }
    return {
      orderId: data.id,
      amountMinor: data.amount,
      currency: data.currency,
      raw: data,
    };
  }

  verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
    if (!/^[a-f0-9]{64}$/.test(signature)) return false;
    const expected = createHmac('sha256', this.credentials.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest();
    return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
  }

  async fetchPayment(paymentId: string) {
    if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) throw new BadRequestException('Invalid payment ID');
    const { keyId, keySecret } = this.credentials;
    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new BadGatewayException(
        'Unable to confirm payment yet. Please refresh registration shortly.',
      );
    return (await response.json()) as {
      id: string;
      order_id: string;
      amount: number;
      currency: string;
      status: string;
      captured: boolean;
      created_at: number;
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
    if (!entity?.id || !entity.order_id || entity.status !== 'captured') {
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

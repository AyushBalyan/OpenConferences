import { createHmac, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  CreateOrderInput,
  CreateOrderResult,
  ParsedWebhookEvent,
  PaymentProvider,
  RefundInput,
  RefundResult,
} from './payment-provider.interface';

type PendingMockOrder = {
  orderId: string;
  amountMinor: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
};

const pendingOrders = new Map<string, PendingMockOrder>();

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const orderId = `order_mock_${randomUUID()}`;
    pendingOrders.set(orderId, {
      orderId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes,
    });

    return {
      orderId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      raw: { id: orderId, amount: input.amountMinor, currency: input.currency },
    };
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const expected = createHmac('sha256', 'mock-webhook-secret').update(rawBody).digest('hex');
    return signature === expected;
  }

  parseWebhook(payload: unknown): ParsedWebhookEvent | null {
    const data = payload as {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id: string;
            order_id: string;
            amount: number;
            currency: string;
            created_at?: number;
          };
        };
      };
    };

    if (data.event !== 'payment.captured') {
      return null;
    }

    const entity = data.payload?.payment?.entity;
    if (!entity?.order_id || !entity.id) {
      return null;
    }

    return {
      eventType: 'payment.captured',
      orderId: entity.order_id,
      paymentId: entity.id,
      amountMinor: entity.amount,
      currency: entity.currency,
      capturedAt: new Date((entity.created_at ?? Date.now() / 1000) * 1000),
      raw: payload,
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    return {
      refundId: `rfnd_mock_${randomUUID()}`,
      amountMinor: input.amountMinor,
      raw: { id: `rfnd_mock_${randomUUID()}`, amount: input.amountMinor },
    };
  }

  getPendingOrder(orderId: string): PendingMockOrder | undefined {
    return pendingOrders.get(orderId);
  }

  buildCaptureWebhook(orderId: string, paymentId?: string): unknown {
    const order = pendingOrders.get(orderId);
    if (!order) {
      throw new Error(`Mock order not found: ${orderId}`);
    }

    return {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: paymentId ?? `pay_mock_${randomUUID()}`,
            order_id: orderId,
            amount: order.amountMinor,
            currency: order.currency,
            status: 'captured',
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      },
    };
  }

  signWebhookPayload(rawBody: Buffer): string {
    return createHmac('sha256', 'mock-webhook-secret').update(rawBody).digest('hex');
  }
}

export function resetMockPaymentProvider(): void {
  pendingOrders.clear();
}

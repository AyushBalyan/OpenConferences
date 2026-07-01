export type CreateOrderInput = {
  amountMinor: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
};

export type CreateOrderResult = {
  orderId: string;
  amountMinor: number;
  currency: string;
  raw: unknown;
};

export type ParsedWebhookEvent = {
  eventType: string;
  orderId: string;
  paymentId: string;
  amountMinor: number;
  currency: string;
  capturedAt: Date;
  raw: unknown;
};

export type RefundInput = {
  paymentId: string;
  amountMinor: number;
  notes?: Record<string, string>;
};

export type RefundResult = {
  refundId: string;
  amountMinor: number;
  raw: unknown;
};

export interface PaymentProvider {
  readonly name: string;
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  verifyWebhookSignature(rawBody: Buffer, signature: string, timestamp?: string): boolean;
  parseWebhook(payload: unknown): ParsedWebhookEvent | null;
  refund(input: RefundInput): Promise<RefundResult>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

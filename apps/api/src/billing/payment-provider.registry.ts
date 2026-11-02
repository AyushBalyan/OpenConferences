import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { getConfig } from '@openconferences/config/env';
import { MockPaymentProvider } from './mock-payment.provider';
import type { PaymentProvider } from './payment-provider.interface';
import { RazorpayProvider } from './razorpay.provider';

@Injectable()
export class PaymentProviderRegistry {
  constructor(
    private readonly razorpay: RazorpayProvider,
    private readonly mock: MockPaymentProvider,
  ) {}

  resolve(_organizationId?: string, _currency?: string): PaymentProvider {
    const config = getConfig();
    if (config.isTest) {
      return this.mock;
    }
    if (!config.razorpay.keyId || !config.razorpay.keySecret) {
      throw new ServiceUnavailableException(
        'Online payments are not configured. Please contact the organizers.',
      );
    }
    return this.razorpay;
  }

  getKeyId(): string {
    const config = getConfig();
    if (config.isTest || !config.razorpay.keyId) {
      return 'mock_key_id';
    }
    return this.razorpay.getKeyId();
  }

  getMockProvider(): MockPaymentProvider {
    return this.mock;
  }
}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { FilesModule } from '../files/files.module';
import { QueueModule } from '../queue/queue.module';
import { SubmissionModule } from '../submission/submission.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { BillingController } from './billing.controller';
import { WebhookController } from './webhook.controller';
import { RegistrationsService } from './registrations.service';
import { PaymentsService } from './payments.service';
import { StudentVerificationService } from './student-verification.service';
import { InvoicesService } from './invoices.service';
import { DiscardSweepService } from './discard-sweep.service';
import { RazorpayProvider } from './razorpay.provider';
import { MockPaymentProvider } from './mock-payment.provider';
import { PaymentProviderRegistry } from './payment-provider.registry';

@Module({
  imports: [AuthModule, TenancyModule, SubmissionModule, FilesModule, AuditModule, QueueModule],
  controllers: [BillingController, WebhookController],
  providers: [
    RegistrationsService,
    PaymentsService,
    StudentVerificationService,
    InvoicesService,
    DiscardSweepService,
    RazorpayProvider,
    MockPaymentProvider,
    PaymentProviderRegistry,
  ],
  exports: [RegistrationsService, PaymentsService, DiscardSweepService, InvoicesService],
})
export class BillingModule {}

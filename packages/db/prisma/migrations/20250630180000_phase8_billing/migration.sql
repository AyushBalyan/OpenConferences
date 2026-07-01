-- CreateEnum
CREATE TYPE "FeeAudience" AS ENUM ('REGULAR', 'STUDENT');
CREATE TYPE "FeeTiming" AS ENUM ('EARLY', 'REGULAR');
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');
CREATE TYPE "PaymentKind" AS ENUM ('INITIAL', 'ADDITIONAL', 'REFUND');
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'AWAITING_VERIFICATION', 'ADDITIONAL_PAYMENT_REQUIRED', 'PAID', 'CANCELLED', 'REFUNDED', 'DISCARDED_NONPAYMENT');
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CLARIFICATION_REQUESTED');

-- CreateTable
CREATE TABLE "registrations" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "conferenceId" UUID NOT NULL,
    "paperId" UUID NOT NULL,
    "userId" UUID,
    "audience" "FeeAudience" NOT NULL,
    "lockedTiming" "FeeTiming",
    "amountDueMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 0,
    "windowOpensAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "additionalGraceUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "registrationId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerOrderId" TEXT,
    "providerPaymentId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "amountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "idempotencyKey" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "fileAssetId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "student_verifications" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "registrationId" UUID NOT NULL,
    "fileAssetId" UUID NOT NULL,
    "reviewedById" UUID,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_verifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_counters" (
    "organizationId" UUID NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "lastNumber" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("organizationId", "fiscalYear")
);

-- CreateIndex
CREATE UNIQUE INDEX "registrations_conferenceId_paperId_key" ON "registrations"("conferenceId", "paperId");
CREATE INDEX "registrations_userId_idx" ON "registrations"("userId");
CREATE INDEX "registrations_conferenceId_status_idx" ON "registrations"("conferenceId", "status");
CREATE INDEX "registrations_deadline_unpaid_idx" ON "registrations"("deadlineAt")
  WHERE "status" NOT IN ('PAID', 'DISCARDED_NONPAYMENT', 'CANCELLED', 'REFUNDED');

CREATE UNIQUE INDEX "payments_provider_providerPaymentId_key" ON "payments"("provider", "providerPaymentId");
CREATE INDEX "payments_registrationId_idx" ON "payments"("registrationId");
CREATE INDEX "payments_idempotencyKey_idx" ON "payments"("idempotencyKey");

CREATE UNIQUE INDEX "invoices_paymentId_key" ON "invoices"("paymentId");
CREATE INDEX "invoices_organizationId_idx" ON "invoices"("organizationId");

CREATE INDEX "student_verifications_registrationId_idx" ON "student_verifications"("registrationId");
CREATE INDEX "student_verifications_status_idx" ON "student_verifications"("status");
CREATE INDEX "student_verifications_pending_queue_idx" ON "student_verifications"("organizationId")
  WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "conferences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "papers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payments" ADD CONSTRAINT "payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "file_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_verifications" ADD CONSTRAINT "student_verifications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_verifications" ADD CONSTRAINT "student_verifications_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_verifications" ADD CONSTRAINT "student_verifications_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "file_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_verifications" ADD CONSTRAINT "student_verifications_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-Level Security
ALTER TABLE "registrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "registrations" FORCE ROW LEVEL SECURITY;
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;
ALTER TABLE "student_verifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_verifications" FORCE ROW LEVEL SECURITY;

CREATE POLICY "registrations_select" ON "registrations"
  FOR SELECT USING (app_user_in_conference("conferenceId"));
CREATE POLICY "registrations_insert" ON "registrations"
  FOR INSERT WITH CHECK (app_user_in_conference("conferenceId") OR app_rls_bypass());
CREATE POLICY "registrations_update" ON "registrations"
  FOR UPDATE USING (app_user_in_conference("conferenceId") OR app_rls_bypass());
CREATE POLICY "registrations_delete" ON "registrations"
  FOR DELETE USING (app_user_in_conference("conferenceId") OR app_rls_bypass());

CREATE POLICY "payments_select" ON "payments"
  FOR SELECT USING (app_user_in_org("organizationId"));
CREATE POLICY "payments_insert" ON "payments"
  FOR INSERT WITH CHECK (app_user_in_org("organizationId") OR app_rls_bypass());
CREATE POLICY "payments_update" ON "payments"
  FOR UPDATE USING (app_user_in_org("organizationId") OR app_rls_bypass());
CREATE POLICY "payments_delete" ON "payments"
  FOR DELETE USING (app_user_in_org("organizationId") OR app_rls_bypass());

CREATE POLICY "invoices_select" ON "invoices"
  FOR SELECT USING (app_user_in_org("organizationId"));
CREATE POLICY "invoices_insert" ON "invoices"
  FOR INSERT WITH CHECK (app_user_in_org("organizationId") OR app_rls_bypass());
CREATE POLICY "invoices_update" ON "invoices"
  FOR UPDATE USING (app_user_in_org("organizationId") OR app_rls_bypass());
CREATE POLICY "invoices_delete" ON "invoices"
  FOR DELETE USING (app_user_in_org("organizationId") OR app_rls_bypass());

CREATE POLICY "student_verifications_select" ON "student_verifications"
  FOR SELECT USING (app_user_in_org("organizationId"));
CREATE POLICY "student_verifications_insert" ON "student_verifications"
  FOR INSERT WITH CHECK (app_user_in_org("organizationId") OR app_rls_bypass());
CREATE POLICY "student_verifications_update" ON "student_verifications"
  FOR UPDATE USING (app_user_in_org("organizationId") OR app_rls_bypass());
CREATE POLICY "student_verifications_delete" ON "student_verifications"
  FOR DELETE USING (app_user_in_org("organizationId") OR app_rls_bypass());

-- Better Auth two-factor plugin fields (verified, lockout counters)
ALTER TABLE "two_factors" ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "two_factors" ADD COLUMN "failedVerificationCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "two_factors" ADD COLUMN "lockedUntil" TIMESTAMP(3);

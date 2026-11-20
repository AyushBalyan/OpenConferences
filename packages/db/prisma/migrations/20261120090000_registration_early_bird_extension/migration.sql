-- A per-paper early-bird cut-off, for papers accepted after the conference-wide one has passed.
ALTER TABLE "registrations" ADD COLUMN "earlyBirdExtendedUntil" TIMESTAMP(3);

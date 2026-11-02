ALTER TABLE registrations
  ADD COLUMN "billingCountry" CHAR(2),
  ADD COLUMN "isAdditionalPaper" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "regularAmountDueMinor" INTEGER;

CREATE INDEX "registrations_conferenceId_userId_isAdditionalPaper_idx"
  ON registrations ("conferenceId", "userId", "isAdditionalPaper");

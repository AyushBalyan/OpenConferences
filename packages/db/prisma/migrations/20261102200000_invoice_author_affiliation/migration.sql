-- Snapshot the registered author's invoice affiliation independently of coauthor edits.
ALTER TABLE registrations ADD COLUMN "billingAffiliation" TEXT;

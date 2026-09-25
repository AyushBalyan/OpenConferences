-- Autosave after submit must not replace the review chairs and authors already received.
ALTER TABLE "reviews" ADD COLUMN "pendingEdit" JSONB;

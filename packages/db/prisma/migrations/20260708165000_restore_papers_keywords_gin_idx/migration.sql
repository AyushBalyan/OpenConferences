-- Restore GIN index on paper keywords (accidentally dropped by drift migration)
CREATE INDEX IF NOT EXISTS "papers_keywords_gin_idx" ON "papers" USING GIN ("keywords");

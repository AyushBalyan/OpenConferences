-- DropIndex
DROP INDEX "papers_keywords_gin_idx";

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "email" SET DATA TYPE TEXT;

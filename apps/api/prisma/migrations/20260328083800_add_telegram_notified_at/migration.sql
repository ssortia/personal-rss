-- AlterTable
ALTER TABLE "user_articles" ADD COLUMN     "telegramNotifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "user_articles_userId_telegramNotifiedAt_idx" ON "user_articles"("userId", "telegramNotifiedAt");

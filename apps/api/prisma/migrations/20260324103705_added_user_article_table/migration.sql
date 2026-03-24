-- CreateTable
CREATE TABLE "user_articles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "scoreReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_articles_userId_score_idx" ON "user_articles"("userId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "user_articles_userId_articleId_key" ON "user_articles"("userId", "articleId");

-- AddForeignKey
ALTER TABLE "user_articles" ADD CONSTRAINT "user_articles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_articles" ADD CONSTRAINT "user_articles_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

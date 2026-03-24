/*
  Warnings:

  - A unique constraint covering the columns `[feedToken]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "feedToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_feedToken_key" ON "users"("feedToken");

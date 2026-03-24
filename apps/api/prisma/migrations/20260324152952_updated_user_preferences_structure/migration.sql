/*
  Warnings:

  - You are about to drop the column `categoryId` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `relevanceThreshold` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,sourceId]` on the table `user_preferences` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `user_preferences` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "user_preferences" DROP CONSTRAINT "user_preferences_categoryId_fkey";

-- DropIndex
DROP INDEX "user_preferences_userId_categoryId_key";

-- AlterTable
ALTER TABLE "user_preferences" DROP COLUMN "categoryId",
DROP COLUMN "createdAt",
ADD COLUMN     "settings" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "relevanceThreshold";

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_sourceId_key" ON "user_preferences"("userId", "sourceId");

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

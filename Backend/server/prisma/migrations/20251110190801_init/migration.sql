/*
  Warnings:

  - You are about to drop the column `description` on the `TestTask` table. All the data in the column will be lost.
  - Added the required column `content` to the `TestTask` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TestTask" DROP COLUMN "description",
ADD COLUMN     "activity" TEXT,
ADD COLUMN     "content" TEXT NOT NULL,
ADD COLUMN     "name" TEXT;

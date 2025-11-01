/*
  Warnings:

  - You are about to drop the column `allowHalfPoints` on the `TestTemplate` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "TestTask" ADD COLUMN     "allowHalfPoints" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "TestTemplate" DROP COLUMN "allowHalfPoints";

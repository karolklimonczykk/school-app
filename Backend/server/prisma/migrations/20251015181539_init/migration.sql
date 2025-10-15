/*
  Warnings:

  - A unique constraint covering the columns `[ownerId,templateId,name]` on the table `Test` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Test_ownerId_templateId_schoolId_classId_name_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Test_ownerId_templateId_name_key" ON "Test"("ownerId", "templateId", "name");

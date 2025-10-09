-- DropForeignKey
ALTER TABLE "TestTask" DROP CONSTRAINT "TestTask_templateId_fkey";

-- AddForeignKey
ALTER TABLE "TestTask" ADD CONSTRAINT "TestTask_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TestTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

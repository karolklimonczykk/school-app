-- DropForeignKey
ALTER TABLE "Class" DROP CONSTRAINT "Class_schoolId_fkey";

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

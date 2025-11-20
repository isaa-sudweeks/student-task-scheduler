-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "creditHours" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "gradeScore" DOUBLE PRECISION,
ADD COLUMN     "gradeTotal" DOUBLE PRECISION,
ADD COLUMN     "gradeWeight" DOUBLE PRECISION;


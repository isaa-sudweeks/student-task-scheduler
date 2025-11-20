-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY');

-- CreateTable
CREATE TABLE "CourseMeeting" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "dayOfWeek" "Weekday" NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "location" TEXT,
    CONSTRAINT "CourseMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseMeeting_courseId_dayOfWeek_idx" ON "CourseMeeting"("courseId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "CourseMeeting" ADD CONSTRAINT "CourseMeeting_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

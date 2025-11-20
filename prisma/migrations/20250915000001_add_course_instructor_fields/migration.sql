ALTER TABLE "Course"
ADD COLUMN "instructorName" TEXT,
ADD COLUMN "instructorEmail" TEXT,
ADD COLUMN "officeHours" TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL;

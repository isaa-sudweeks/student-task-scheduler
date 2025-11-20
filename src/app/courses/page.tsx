"use client";
import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { Pencil } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CourseModal, type Course } from "@/components/course-modal";
import { api } from "@/server/api/react";
import { CourseMembersDialog } from "@/components/course-members-dialog";
import { percentageToLetterGrade } from "@/lib/grades";

export default function CoursesPage() {
  const { data: session } = useSession();
  const { data: courses = [] } = api.course.list.useQuery(
    { page: 1, limit: 100 },
    { enabled: !!session }
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"createdAt" | "title">("createdAt");
  const [managing, setManaging] = useState<Course | null>(null);

  const displayed = [...courses]
    .filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      return (
        new Date((b as any).createdAt ?? 0).getTime() -
        new Date((a as any).createdAt ?? 0).getTime()
      );
    });

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-semibold">Courses</h1>
      <Button
        onClick={() => {
          setEditing(null);
          setModalOpen(true);
        }}
        className="self-start"
      >
        + Add Course
      </Button>
      <div className="rounded-xl border bg-white dark:bg-zinc-900 shadow-sm p-4 space-y-3 max-w-md">
        <div className="flex items-center gap-2">
          <Input
            className="w-40 md:w-80"
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Sort by"
            className="h-9 rounded-md border border-black/10 bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
            value={sort}
            onChange={(e) => setSort(e.target.value as "createdAt" | "title")}
          >
            <option value="createdAt">Creation date</option>
            <option value="title">Title</option>
          </select>
        </div>
      </div>
      {courses.length === 0 ? (
        <p>No courses yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {displayed.map((c) => (
            <CourseTile
              key={c.id}
              course={c as Course}
              onEdit={(course) => {
                setEditing(course);
                setModalOpen(true);
              }}
              onManage={(course) => setManaging(course)}
            />
          ))}
        </div>
      )}
      <CourseModal
        open={modalOpen}
        mode={editing ? "edit" : "create"}
        course={editing ?? undefined}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
      />
      {managing && (
        <CourseMembersDialog
          courseId={managing.id}
          courseTitle={managing.title}
          open={!!managing}
          onClose={() => setManaging(null)}
        />
      )}
    </main>
  );
}

type CourseTileProps = {
  course: Course;
  onEdit: (c: Course) => void;
  onManage: (c: Course) => void;
};

function CourseTile({ course, onEdit, onManage }: CourseTileProps) {
  const collaborators = (course.members ?? []).filter(
    (member) => member.user?.name || member.user?.email,
  );
  const gradeAverage = (course as unknown as { gradeAverage?: number | null }).gradeAverage ?? null;
  const letter = gradeAverage != null ? percentageToLetterGrade(gradeAverage)?.letter ?? null : null;
  const creditHours = (course as unknown as { creditHours?: number | null }).creditHours ?? null;
  const gradedTaskCount = (course as unknown as { gradedTaskCount?: number }).gradedTaskCount ?? 0;
  const gradeLabel =
    gradeAverage != null
      ? `${gradeAverage.toFixed(1)}%${letter ? ` (${letter})` : ""}`
      : null;
  return (
    <div
      role="listitem"
      className="flex h-full flex-col justify-between rounded-xl border shadow-sm p-4"
    >
      <Link href={`/courses/${course.id}`} className="flex-1">
        <h2 className="font-medium">{course.title}</h2>
        {course.term && (
          <p className="text-sm text-muted-foreground">{course.term}</p>
        )}
        {(course.instructorName || course.instructorEmail) && (
          <p className="mt-2 text-sm text-muted-foreground">
            Instructor:{" "}
            <span className="text-foreground">
              {course.instructorName || course.instructorEmail}
            </span>
          </p>
        )}
        {course.officeHours?.length ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Next office hours: {course.officeHours[0]}
          </p>
        ) : null}
        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
          {gradeLabel && <p>Current grade: {gradeLabel}</p>}
          {typeof creditHours === "number" && (
            <p>Credit hours: {creditHours}</p>
          )}
          {gradedTaskCount > 0 && <p>Graded tasks: {gradedTaskCount}</p>}
        </div>
      </Link>
      <div className="mt-3 space-y-3">
        {collaborators.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Collaborators:</span>{" "}
            {collaborators
              .map((member) => member.user?.name ?? member.user?.email ?? "Unknown")
              .join(", ")}
          </div>
        )}
        <div className="flex justify-between gap-2">
          <button
            type="button"
            aria-label="Edit course"
            className="p-1 text-neutral-400 hover:text-neutral-700"
            onClick={() => onEdit(course)}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <Button
            variant="tertiary"
            className="text-xs"
            onClick={() => onManage(course)}
          >
            Manage collaborators
          </Button>
        </div>
      </div>
    </div>
  );
}


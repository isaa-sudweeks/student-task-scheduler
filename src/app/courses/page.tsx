"use client";
import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { Pencil } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CourseModal, { Course } from "@/components/course-modal";
import { api } from "@/server/api/react";

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
    </main>
  );
}

type CourseTileProps = { course: Course; onEdit: (c: Course) => void };

function CourseTile({ course, onEdit }: CourseTileProps) {
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
      </Link>
      <div className="flex justify-end">
        <button
          type="button"
          aria-label="Edit course"
          className="p-1 text-neutral-400 hover:text-neutral-700"
          onClick={() => onEdit(course)}
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}


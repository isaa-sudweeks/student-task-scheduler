"use client";
import React, { useState } from "react";
import { api } from "@/server/api/react";
import { Button } from "@/components/ui/button";

export default function CoursesPage() {
  const utils = api.useUtils();
  const {
    data: courses = [],
    isLoading,
    error,
  } = api.course.list.useQuery();
  const {
    mutate: createCourse,
    isPending: isCreating,
    error: createError,
  } = api.course.create.useMutation({
    onSuccess: () => utils.course.list.invalidate(),
  });
  const [title, setTitle] = useState("");
  const [term, setTerm] = useState("");
  const [color, setColor] = useState("");
  const isAddDisabled = isCreating || title.trim() === "";

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p className="text-red-500">{error.message}</p>;

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Courses</h1>
      <div className="flex flex-col gap-2 max-w-md">
        <label htmlFor="course-title" className="flex flex-col gap-1">
          Course title
          <input
            id="course-title"
            className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
            placeholder="Course title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label htmlFor="course-term" className="flex flex-col gap-1">
          Term (optional)
          <input
            id="course-term"
            className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
            placeholder="Term (optional)"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </label>
        <label htmlFor="course-color" className="flex flex-col gap-1">
          Color (optional)
          <div className="flex items-center gap-2">
            <input
              id="course-color"
              type="color"
              aria-label="Course color"
              className="h-10 w-10 rounded border border-black/10 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
              value={color || "#000000"}
              onChange={(e) => setColor(e.target.value)}
            />
            <div
              data-testid="color-preview"
              className="h-6 w-6 rounded border border-black/10 dark:border-white/10"
              style={{ backgroundColor: color || "#000000" }}
            />
          </div>
        </label>
        <Button
          disabled={isAddDisabled}
          onClick={() => {
            const t = title.trim();
            if (!t) return;
            createCourse({ title: t, term: term.trim() || undefined, color: color.trim() || undefined });
            setTitle("");
            setTerm("");
            setColor("");
          }}
        >
          Add Course
        </Button>
        {createError && <p className="text-red-500">{createError.message}</p>}
      </div>
      <ul className="space-y-4 max-w-md">
        {courses.map((c) => (
          <CourseItem key={c.id} course={c} />
        ))}
      </ul>
    </main>
  );
}

function CourseItem({ course }: { course: { id: string; title: string; term: string | null; color: string | null } }) {
  const utils = api.useUtils();
  const {
    mutate: updateCourse,
    isPending: isUpdating,
    error: updateError,
  } = api.course.update.useMutation({
    onSuccess: () => utils.course.list.invalidate(),
  });
  const {
    mutate: deleteCourse,
    isPending: isDeleting,
    error: deleteError,
  } = api.course.delete.useMutation({
    onSuccess: () => utils.course.list.invalidate(),
  });
  const [title, setTitle] = useState(course.title);
  const [term, setTerm] = useState(course.term ?? "");
  const [color, setColor] = useState(course.color ?? "");
  const titleId = `course-${course.id}-title`;
  const termId = `course-${course.id}-term`;
  const colorId = `course-${course.id}-color`;
  const trimmedTitle = title.trim();
  const trimmedTerm = term.trim();
  const trimmedColor = color.trim();
  const hasChanges =
    trimmedTitle !== course.title ||
    trimmedTerm !== (course.term ?? "") ||
    trimmedColor !== (course.color ?? "");
  const isSaveDisabled = isUpdating || !hasChanges;
  return (
    <li className="flex flex-col gap-2 border-b pb-4">
      <label htmlFor={titleId} className="flex flex-col gap-1">
        Title
        <input
          id={titleId}
          className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label htmlFor={termId} className="flex flex-col gap-1">
        Term
        <input
          id={termId}
          className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </label>
      <label htmlFor={colorId} className="flex flex-col gap-1">
        Color
        <div className="flex items-center gap-2">
          <input
            id={colorId}
            type="color"
            aria-label="Course color"
            className="h-10 w-10 rounded border border-black/10 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
            value={color || "#000000"}
            onChange={(e) => setColor(e.target.value)}
          />
          <div
            className="h-6 w-6 rounded border border-black/10 dark:border-white/10"
            style={{ backgroundColor: color || "#000000" }}
          />
        </div>
      </label>
      <div className="flex gap-2">
        <Button
          disabled={isSaveDisabled}
          onClick={() =>
            updateCourse({
              id: course.id,
              title: trimmedTitle,
              term: trimmedTerm || null,
              color: trimmedColor || null,
            })
          }
        >
          Save
        </Button>
        <Button
          variant="danger"
          disabled={isDeleting}
          onClick={() => {
            if (window.confirm("Delete this course?")) {
              deleteCourse({ id: course.id });
            }
          }}
        >
          Delete
        </Button>
      </div>
      {updateError && <p className="text-red-500">{updateError.message}</p>}
      {deleteError && <p className="text-red-500">{deleteError.message}</p>}
    </li>
  );
}

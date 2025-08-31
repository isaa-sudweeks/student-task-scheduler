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

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p className="text-red-500">{error.message}</p>;

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Courses</h1>
      <div className="flex flex-col gap-2 max-w-md">
        <input
          className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
          placeholder="Course title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
          placeholder="Term (optional)"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        <input
          className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
          placeholder="Color (optional)"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
        <Button
          disabled={isCreating}
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
  return (
    <li className="flex flex-col gap-2 border-b pb-4">
      <input
        className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />
      <input
        className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
        value={color}
        onChange={(e) => setColor(e.target.value)}
      />
      <div className="flex gap-2">
        <Button
          disabled={isUpdating}
          onClick={() =>
            updateCourse({
              id: course.id,
              title: title.trim(),
              term: term.trim() || null,
              color: color.trim() || null,
            })
          }
        >
          Save
        </Button>
        <Button
          variant="danger"
          disabled={isDeleting}
          onClick={() => deleteCourse({ id: course.id })}
        >
          Delete
        </Button>
      </div>
      {updateError && <p className="text-red-500">{updateError.message}</p>}
      {deleteError && <p className="text-red-500">{deleteError.message}</p>}
    </li>
  );
}


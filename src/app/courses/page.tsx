"use client";
import React, { useState } from "react";
import { api } from "@/server/api/react";
import { Button } from "@/components/ui/button";

export default function CoursesPage() {
  const utils = api.useUtils();
  const { data: courses = [] } = api.course.list.useQuery();
  const create = api.course.create.useMutation({
    onSuccess: () => utils.course.list.invalidate(),
  });
  const [title, setTitle] = useState("");
  const [term, setTerm] = useState("");
  const [color, setColor] = useState("");

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
          <input
            id="course-color"
            className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
            placeholder="Color (optional)"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </label>
        <Button
          onClick={() => {
            const t = title.trim();
            if (!t) return;
            create.mutate({ title: t, term: term.trim() || undefined, color: color.trim() || undefined });
            setTitle("");
            setTerm("");
            setColor("");
          }}
        >
          Add Course
        </Button>
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
  const update = api.course.update.useMutation({
    onSuccess: () => utils.course.list.invalidate(),
  });
  const del = api.course.delete.useMutation({
    onSuccess: () => utils.course.list.invalidate(),
  });
  const [title, setTitle] = useState(course.title);
  const [term, setTerm] = useState(course.term ?? "");
  const [color, setColor] = useState(course.color ?? "");
  const titleId = `course-${course.id}-title`;
  const termId = `course-${course.id}-term`;
  const colorId = `course-${course.id}-color`;
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
        <input
          id={colorId}
          className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
      </label>
      <div className="flex gap-2">
        <Button
          onClick={() =>
            update.mutate({ id: course.id, title: title.trim(), term: term.trim() || null, color: color.trim() || null })
          }
        >
          Save
        </Button>
        <Button variant="danger" onClick={() => del.mutate({ id: course.id })}>
          Delete
        </Button>
      </div>
    </li>
  );
}


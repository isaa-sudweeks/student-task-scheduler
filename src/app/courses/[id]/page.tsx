"use client";
import React, { useCallback, useState } from "react";
import { TaskList } from "@/components/task-list";
import { TaskModal } from "@/components/task-modal";
import { Button } from "@/components/ui/button";
import { api } from "@/server/api/react";

export default function CoursePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: course } = api.course.list.useQuery(
    { page: 1, limit: 100 },
    { select: (courses) => courses.find((c) => c.id === id) }
  );
  const update = api.course.update.useMutation();
  const [showModal, setShowModal] = useState(false);
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      await update.mutateAsync({ id, syllabusUrl: data.url });
    },
    [id, update]
  );

  if (!course) {
    return <div>Loading...</div>;
  }

  // Some list queries may not carry syllabusUrl in the inferred type.
  // It exists in the Course model; narrow softly for rendering.
  const syllabusUrl = (course as unknown as { syllabusUrl?: string | null })
    .syllabusUrl ?? null;

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{course.title}</h1>
        {course.term && (
          <p className="text-sm text-muted-foreground">{course.term}</p>
        )}
      </div>
      <div className="rounded-xl border bg-white dark:bg-zinc-900 shadow-sm p-4 space-y-4">
        <div className="space-y-2">
          <label htmlFor="syllabus" className="block text-sm font-medium">
            Upload syllabus
          </label>
          <input
            id="syllabus"
            type="file"
            accept=".pdf"
            aria-label="Upload syllabus"
            onChange={handleFileChange}
          />
          {syllabusUrl && (
            <a
              href={syllabusUrl}
              className="text-indigo-600 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              View current syllabus
            </a>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-white dark:bg-zinc-900 shadow-sm p-4 space-y-4">
        <TaskList
          filter="all"
          subject={null}
          status={null}
          priority={null}
          courseId={id}
          projectId={null}
          query=""
        />
        <Button onClick={() => setShowModal(true)}>+ Add Task</Button>
      </div>
      <TaskModal
        open={showModal}
        mode="create"
        onClose={() => setShowModal(false)}
        initialCourseId={id}
      />
    </main>
  );
}

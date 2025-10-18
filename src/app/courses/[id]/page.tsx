"use client";
import React, { useCallback, useState } from "react";
import { TaskList } from "@/components/task-list";
import { TaskModal } from "@/components/task-modal";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { api } from "@/server/api/react";

export default function CoursePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: course } = api.course.list.useQuery(
    { page: 1, limit: 100 },
    { select: (courses) => courses.find((c) => c.id === id) }
  );
  const utils = api.useUtils();
  const update = api.course.update.useMutation({
    onSuccess: () => utils.course.list.invalidate(),
  });
  const [showModal, setShowModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputEl = e.target;
      const file = inputEl.files?.[0];
      if (!file) return;

      const MAX_FILE_SIZE_MB = 10;
      const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
      const isPdf =
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

      if (!isPdf) {
        toast.error("Only PDF files can be uploaded.");
        inputEl.value = "";
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`File must be smaller than ${MAX_FILE_SIZE_MB}MB.`);
        inputEl.value = "";
        return;
      }

      setIsUploading(true);

      try {
        const formData = new FormData();
        formData.set("file", file);

        const response = await fetch("/api/upload", { method: "POST", body: formData });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          const message =
            (payload && typeof payload.error === "string" && payload.error) ||
            "Upload failed. Please try again.";
          throw new Error(message);
        }

        const url = payload?.url;
        if (typeof url !== "string" || url.length === 0) {
          throw new Error("Upload failed. Please try again.");
        }

        await update.mutateAsync({ id, syllabusUrl: url });
        toast.success("Syllabus uploaded.");
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Upload failed. Please try again.";
        toast.error(message);
      } finally {
        setIsUploading(false);
        inputEl.value = "";
      }
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
            aria-busy={isUploading}
            disabled={isUploading}
            onChange={handleFileChange}
          />
          {isUploading && (
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
              Uploading...
            </p>
          )}
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

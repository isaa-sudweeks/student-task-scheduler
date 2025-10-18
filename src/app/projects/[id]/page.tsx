"use client";
import React, { useCallback, useState } from "react";
import { TaskList } from "@/components/task-list";
import { TaskModal } from "@/components/task-modal";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { api } from "@/server/api/react";

export default function ProjectPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: project } = api.project.get.useQuery({ id });
  const utils = api.useUtils();
  const update = api.project.update.useMutation({
    onSuccess: async (_, variables) => {
      await Promise.all([
        utils.project.get.invalidate({ id: variables.id }),
        utils.project.list.invalidate(),
      ]);
    },
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

        await update.mutateAsync({ id: params.id, instructionsUrl: url });
        toast.success("Instructions uploaded.");
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
    [params.id, update]
  );

  if (!project) {
    return <div>Loading...</div>;
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{project.title}</h1>
        {project.description && (
          <p className="text-sm text-muted-foreground">{project.description}</p>
        )}
      </div>
      <div className="rounded-xl border bg-white dark:bg-zinc-900 shadow-sm p-4 space-y-4">
        <div className="space-y-2">
          <label htmlFor="instructions" className="block text-sm font-medium">
            Upload instructions
          </label>
          <input
            id="instructions"
            type="file"
            accept=".pdf"
            aria-label="Upload instructions"
            aria-busy={isUploading}
            disabled={isUploading}
            onChange={handleFileChange}
          />
          {isUploading && (
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
              Uploading...
            </p>
          )}
          {project.instructionsUrl && (
            <a
              href={project.instructionsUrl}
              className="text-indigo-600 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              View current instructions
            </a>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-white shadow-sm p-4 space-y-4">
        <TaskList
          filter="all"
          subject={null}
          status={null}
          priority={null}
          courseId={null}
          projectId={id}
          query=""
        />
        <Button onClick={() => setShowModal(true)}>+ Add Task</Button>
      </div>
      <TaskModal
        open={showModal}
        mode="create"
        onClose={() => setShowModal(false)}
        initialProjectId={id}
      />
    </main>
  );
}

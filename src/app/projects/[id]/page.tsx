"use client";
import React, { useCallback, useState } from "react";
import { TaskList } from "@/components/task-list";
import { TaskModal } from "@/components/task-modal";
import { Button } from "@/components/ui/button";
import { api } from "@/server/api/react";

export default function ProjectPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: project } = api.project.get.useQuery({ id });
  const update = api.project.update.useMutation();
  const [showModal, setShowModal] = useState(false);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      await update.mutateAsync({ id: params.id, instructionsUrl: data.url });
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
            onChange={handleFileChange}
          />
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

"use client";
import React, { useCallback } from "react";
import { api } from "@/server/api/react";

export default function ProjectPage({ params }: { params: { id: string } }) {
  const { data: project } = api.project.get.useQuery({ id: params.id });
  const update = api.project.update.useMutation();

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
      <h1 className="text-2xl font-semibold">{project.title}</h1>
      {project.description && <p>{project.description}</p>}
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
    </main>
  );
}

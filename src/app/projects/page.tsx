"use client";
import React, { useState } from "react";
import { api } from "@/server/api/react";
import { Button } from "@/components/ui/button";

export default function ProjectsPage() {
  const utils = api.useUtils();
  const { data: projects = [] } = api.project.list.useQuery();
  const create = api.project.create.useMutation({
    onSuccess: () => utils.project.list.invalidate(),
  });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [titleError, setTitleError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Projects</h1>
      <div className="flex flex-col gap-2 max-w-md">
        <input
          className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
          placeholder="Project title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (titleError) setTitleError("");
          }}
          aria-invalid={!!titleError}
        />
        {titleError && <p className="text-sm text-red-500">{titleError}</p>}
        <textarea
          className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (descriptionError) setDescriptionError("");
          }}
          aria-invalid={!!descriptionError}
        />
        {descriptionError && <p className="text-sm text-red-500">{descriptionError}</p>}
        <Button
          onClick={() => {
            const t = title.trim();
            const d = description.trim();
            let hasError = false;
            if (t.length < 1 || t.length > 200) {
              setTitleError("Title must be between 1 and 200 characters.");
              hasError = true;
            }
            if (d.length > 1000) {
              setDescriptionError("Description must be at most 1000 characters.");
              hasError = true;
            }
            if (hasError) return;
            create.mutate({ title: t, description: d || undefined });
            setTitle("");
            setDescription("");
          }}
        >
          Add Project
        </Button>
      </div>
      <ul className="space-y-4 max-w-md">
        {projects.map((p) => (
          <ProjectItem key={p.id} project={p} />
        ))}
      </ul>
    </main>
  );
}

function ProjectItem({ project }: { project: { id: string; title: string; description: string | null } }) {
  const utils = api.useUtils();
  const update = api.project.update.useMutation({
    onSuccess: () => utils.project.list.invalidate(),
  });
  const del = api.project.delete.useMutation({
    onSuccess: () => utils.project.list.invalidate(),
  });
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description ?? "");
  const [titleError, setTitleError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");
  return (
    <li className="flex flex-col gap-2 border-b pb-4">
      <input
        className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          if (titleError) setTitleError("");
        }}
        aria-invalid={!!titleError}
      />
      {titleError && <p className="text-sm text-red-500">{titleError}</p>}
      <textarea
        className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
        value={description}
        onChange={(e) => {
          setDescription(e.target.value);
          if (descriptionError) setDescriptionError("");
        }}
        aria-invalid={!!descriptionError}
      />
      {descriptionError && <p className="text-sm text-red-500">{descriptionError}</p>}
      <div className="flex gap-2">
        <Button
          onClick={() => {
            const t = title.trim();
            const d = description.trim();
            let hasError = false;
            if (t.length < 1 || t.length > 200) {
              setTitleError("Title must be between 1 and 200 characters.");
              hasError = true;
            }
            if (d.length > 1000) {
              setDescriptionError("Description must be at most 1000 characters.");
              hasError = true;
            }
            if (hasError) return;
            update.mutate({ id: project.id, title: t, description: d || null });
          }}
        >
          Save
        </Button>
        <Button variant="danger" onClick={() => del.mutate({ id: project.id })}>
          Delete
        </Button>
      </div>
    </li>
  );
}


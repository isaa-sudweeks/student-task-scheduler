"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { api } from "@/server/api/react";

export default function ProjectsPage() {
  const utils = api.useUtils();
  const { data: projects = [] } = api.project.list.useQuery();
  const create = api.project.create.useMutation({
    onSuccess: () => {
      toast.success("Saved!");
      utils.project.list.invalidate();
    },
    onError: (e) => toast.error(e.message || "Create failed."),
  });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [titleError, setTitleError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
  };

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Projects</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 max-w-md">
        <label htmlFor="new-project-title" className="sr-only">
          Project title
        </label>
        <input
          id="new-project-title"
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
        <label htmlFor="new-project-description" className="sr-only">
          Description (optional)
        </label>
        <textarea
          id="new-project-description"
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
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Saving..." : "Add Project"}
        </Button>
      </form>
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
    onSuccess: () => {
      toast.success("Saved!");
      utils.project.list.invalidate();
    },
    onError: (e) => toast.error(e.message || "Update failed."),
  });
  const del = api.project.delete.useMutation({
    onSuccess: () => {
      toast.success("Saved!");
      utils.project.list.invalidate();
    },
    onError: (e) => toast.error(e.message || "Delete failed."),
  });
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description ?? "");
  const [titleError, setTitleError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");
  return (
    <li className="flex flex-col gap-2 border-b pb-4">
      <label htmlFor={`project-${project.id}-title`} className="sr-only">
        Project title
      </label>
      <input
        id={`project-${project.id}-title`}
        className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          if (titleError) setTitleError("");
        }}
        aria-invalid={!!titleError}
      />
      {titleError && <p className="text-sm text-red-500">{titleError}</p>}
      <label htmlFor={`project-${project.id}-description`} className="sr-only">
        Description
      </label>
      <textarea
        id={`project-${project.id}-description`}
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
          disabled={update.isPending}
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
          {update.isPending ? "Saving..." : "Save"}
        </Button>
        <Button
          variant="danger"
          disabled={del.isPending}
          onClick={() => del.mutate({ id: project.id })}
        >
          {del.isPending ? "Deleting..." : "Delete"}
        </Button>
      </div>
    </li>
  );
}

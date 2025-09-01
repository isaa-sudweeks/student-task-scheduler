"use client";
import React, { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

import { EmptyProjects } from "@/components/empty-projects";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { api } from "@/server/api/react";

export default function ProjectsPage() {
  const utils = api.useUtils();
  const { data: session } = useSession();
  const { data: projects = [] } = api.project.list.useQuery(undefined, { enabled: !!session });
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

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"createdAt" | "title">("createdAt");

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

  const displayed = [...projects]
    .filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      return (
        new Date((b as any).createdAt ?? 0).getTime() -
        new Date((a as any).createdAt ?? 0).getTime()
      );
    });

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
      <div className="flex flex-col gap-2 max-w-md">
        <input
          className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Sort by"
          className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
          value={sort}
          onChange={(e) => setSort(e.target.value as "createdAt" | "title")}
        >
          <option value="createdAt">Creation date</option>
          <option value="title">Title</option>
        </select>
      </div>
      {projects.length === 0 ? (
        <EmptyProjects onAdd={() => document.getElementById("new-project-title")?.focus()} />
      ) : (
        <ul className="space-y-4 max-w-md">
          {displayed.map((p) => (
            <ProjectItem key={p.id} project={p} />
          ))}
        </ul>
      )}
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
  const initialTitle = useRef(project.title);
  const initialDescription = useRef(project.description ?? "");
  const [title, setTitle] = useState(initialTitle.current);
  const [description, setDescription] = useState(initialDescription.current);
  const [titleError, setTitleError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");

  useEffect(() => {
    initialTitle.current = project.title;
    initialDescription.current = project.description ?? "";
    setTitle(project.title);
    setDescription(project.description ?? "");
  }, [project.title, project.description]);
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
          variant="secondary"
          onClick={() => {
            setTitle(initialTitle.current);
            setDescription(initialDescription.current);
            setTitleError("");
            setDescriptionError("");
          }}
        >
          Cancel
        </Button>
        <Button
          variant="danger"
          disabled={del.isPending}
          onClick={() => {
            if (window.confirm("Delete this project?")) {
              del.mutate({ id: project.id });
            }
          }}
        >
          {del.isPending ? "Deleting..." : "Delete"}
        </Button>
      </div>
    </li>
  );
}

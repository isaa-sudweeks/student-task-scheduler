"use client";
import React, { useEffect, useRef, useState } from "react";
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

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Projects</h1>
      <div className="flex flex-col gap-2 max-w-md">
        <input
          className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
          placeholder="Project title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Button
          onClick={() => {
            const t = title.trim();
            if (!t) return;
            create.mutate({ title: t, description: description.trim() || undefined });
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
  const initialTitle = useRef(project.title);
  const initialDescription = useRef(project.description ?? "");
  const [title, setTitle] = useState(initialTitle.current);
  const [description, setDescription] = useState(initialDescription.current);

  useEffect(() => {
    initialTitle.current = project.title;
    initialDescription.current = project.description ?? "";
    setTitle(project.title);
    setDescription(project.description ?? "");
  }, [project.title, project.description]);
  return (
    <li className="flex flex-col gap-2 border-b pb-4">
      <input
        className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="flex gap-2">
        <Button
          onClick={() =>
            update.mutate({ id: project.id, title: title.trim(), description: description.trim() || null })
          }
        >
          Save
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setTitle(initialTitle.current);
            setDescription(initialDescription.current);
          }}
        >
          Cancel
        </Button>
        <Button variant="danger" onClick={() => del.mutate({ id: project.id })}>
          Delete
        </Button>
      </div>
    </li>
  );
}


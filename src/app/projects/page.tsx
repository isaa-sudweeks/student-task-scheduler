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

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Projects</h1>
      <div className="flex flex-col gap-2 max-w-md">
        <input
          className="rounded border border-black/10 bg-transparent px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:focus:ring-white/20"
          placeholder="Project title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="rounded border border-black/10 bg-transparent px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:focus:ring-white/20"
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
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description ?? "");
  return (
    <li className="flex flex-col gap-2 border-b pb-4">
      <input
        className="rounded border border-black/10 bg-transparent px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:focus:ring-white/20"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="rounded border border-black/10 bg-transparent px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:focus:ring-white/20"
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
        <Button variant="danger" onClick={() => del.mutate({ id: project.id })}>
          Delete
        </Button>
      </div>
    </li>
  );
}


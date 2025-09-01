"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/server/api/react";
import { useSession } from "next-auth/react";
import { Pencil } from "lucide-react";
import ProjectModal, { Project } from "@/components/project-modal";

export default function ProjectsPage() {
  const { data: session } = useSession();
  const { data: projects = [] } = api.project.list.useQuery(undefined, {
    enabled: !!session,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"createdAt" | "title">("createdAt");

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
      <Button
        onClick={() => {
          setEditing(null);
          setModalOpen(true);
        }}
        className="self-start"
      >
        + Add Project
      </Button>
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
        <p className="text-sm text-muted-foreground">No projects yet—add one above.</p>
      ) : (
        <ul className="space-y-4 max-w-md">
          {displayed.map((p) => (
            <ProjectItem key={p.id} project={p} onEdit={(proj) => {
              setEditing(proj);
              setModalOpen(true);
            }} />
          ))}
        </ul>
      )}
      <ProjectModal
        open={modalOpen}
        mode={editing ? "edit" : "create"}
        project={editing ?? undefined}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
      />
    </main>
  );
}

type ProjectItemProps = { project: Project; onEdit: (p: Project) => void };

function ProjectItem({ project, onEdit }: ProjectItemProps) {
  return (
    <li className="flex items-start justify-between border-b pb-4">
      <div>
        <h2 className="font-medium">{project.title}</h2>
        {project.description && (
          <p className="text-sm text-muted-foreground">{project.description}</p>
        )}
      </div>
      <button
        type="button"
        aria-label="Edit project"
        className="p-1 text-neutral-400 hover:text-neutral-700"
        onClick={() => onEdit(project)}
      >
        <Pencil className="h-4 w-4" />
      </button>
    </li>
  );
}

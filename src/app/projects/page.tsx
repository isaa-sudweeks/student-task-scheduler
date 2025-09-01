"use client";
import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { Pencil } from "lucide-react";

import { EmptyProjects } from "@/components/empty-projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ProjectModal, { Project } from "@/components/project-modal";
import { api } from "@/server/api/react";

export default function ProjectsPage() {
  const { data: session } = useSession();
  const { data: projects = [] } = api.project.list.useQuery(undefined, { enabled: !!session });
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
    <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
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
      <div className="rounded-xl border bg-white dark:bg-zinc-900 shadow-sm p-4 space-y-3 max-w-md">
        <div className="flex items-center gap-2">
          <Input
            className="w-40 md:w-80"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Sort by"
            className="h-9 rounded-md border border-black/10 bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
            value={sort}
            onChange={(e) => setSort(e.target.value as "createdAt" | "title")}
          >
            <option value="createdAt">Creation date</option>
            <option value="title">Title</option>
          </select>
        </div>
      </div>
      {projects.length === 0 ? (
        <EmptyProjects
          onAdd={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {displayed.map((p) => (
            <ProjectTile
              key={p.id}
              project={p as Project}
              onEdit={(proj) => {
                setEditing(proj);
                setModalOpen(true);
              }}
            />
          ))}
        </div>
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

type ProjectTileProps = { project: Project; onEdit: (p: Project) => void };

function ProjectTile({ project, onEdit }: ProjectTileProps) {
  return (
    <div
      role="listitem"
      className="flex h-full flex-col justify-between rounded-xl border shadow-sm p-4"
    >
      <div>
        <h2 className="font-medium">{project.title}</h2>
        {project.description && (
          <p className="text-sm text-muted-foreground">{project.description}</p>
        )}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          aria-label="Edit project"
          className="p-1 text-neutral-400 hover:text-neutral-700"
          onClick={() => onEdit(project)}
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

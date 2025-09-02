"use client";
import React, { useState } from "react";
import { TaskList } from "@/components/task-list";
import { TaskModal } from "@/components/task-modal";
import { Button } from "@/components/ui/button";
import { api } from "@/server/api/react";

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: project } = api.project.byId.useQuery({ id });
  const [showModal, setShowModal] = useState(false);

  if (!project) return null;

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{project.title}</h1>
        {project.description && (
          <p className="text-sm text-muted-foreground">{project.description}</p>
        )}
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

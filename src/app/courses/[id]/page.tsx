"use client";
import React, { useState } from "react";
import { TaskList } from "@/components/task-list";
import { TaskModal } from "@/components/task-modal";
import { Button } from "@/components/ui/button";
import { api } from "@/server/api/react";

export default function CoursePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: course } = api.course.list.useQuery(
    { page: 1, limit: 100 },
    { select: (courses) => courses.find((c) => c.id === id) }
  );
  const [showModal, setShowModal] = useState(false);

  if (!course) {
    return <div>Loading...</div>;
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{course.title}</h1>
        {course.term && (
          <p className="text-sm text-muted-foreground">{course.term}</p>
        )}
      </div>
      <div className="rounded-xl border bg-white dark:bg-zinc-900 shadow-sm p-4 space-y-4">
        <TaskList
          filter="all"
          subject={null}
          priority={null}
          courseId={id}
          projectId={null}
          query=""
        />
        <Button onClick={() => setShowModal(true)}>+ Add Task</Button>
      </div>
      <TaskModal open={showModal} mode="create" onClose={() => setShowModal(false)} />
    </main>
  );
}

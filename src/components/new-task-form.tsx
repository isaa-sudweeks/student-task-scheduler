"use client";
import React, { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskModal } from "@/components/task-modal";
import { api } from "@/server/api/react";
import { toast } from "@/lib/toast";

export function NewTaskForm() {
  const utils = api.useUtils();
  const [title, setTitle] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [pendingDueAt, setPendingDueAt] = useState<Date | null>(null);

  const create = api.task.create.useMutation({
    onSuccess: async () => {
      setTitle("");
      setPendingDueAt(null);
      await utils.task.list.invalidate();
      toast.success("Task added.");
    },
    onError: (e) => toast.error(e.message || "Create failed."),
  });

  return (
    <div className="flex items-center gap-2">
      <input
        className="flex-1 rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
        placeholder="Add a task…"
        aria-label="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const t = title.trim();
            if (!t) return;
            create.mutate({ title: t });
          }
        }}
      />
      {pendingDueAt && (
        <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800">
          Due {formatDueHint(pendingDueAt)}
        </span>
      )}
      <Button
        variant="secondary"
        aria-label="More options"
        onClick={() => setShowModal(true)}
        title="Add with more options"
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      <TaskModal
        open={showModal}
        mode="create"
        onClose={() => setShowModal(false)}
        initialTitle={title}
        initialDueAt={pendingDueAt}
        onDraftDueChange={setPendingDueAt}
      />
    </div>
  );
}

function formatDueHint(d: Date): string {
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `today ${time}`;
  if (isTomorrow) return `tomorrow ${time}`;
  return d.toLocaleString();
}

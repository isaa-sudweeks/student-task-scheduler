"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/server/api/react";
import { toast } from "react-hot-toast";
import { MoreHorizontal, Plus } from "lucide-react";
import { TaskModal } from "@/components/task-modal";

export function NewTaskForm() {
  const utils = api.useUtils();
  const [showQuick, setShowQuick] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [showModal, setShowModal] = useState(false);

  const create = api.task.create.useMutation({
    onSuccess: async () => {
      setQuickTitle("");
      setShowQuick(false);
      await utils.task.list.invalidate();
    },
    onError: (e) => toast.error(e.message || "Failed to create task"),
  });

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <Button
          onClick={() => setShowQuick((v) => !v)}
          aria-label="Quick add task"
        >
          <Plus className="mr-2 h-4 w-4" /> Add Task
        </Button>
        <Button
          variant="secondary"
          aria-label="More options"
          onClick={() => setShowModal(true)}
          title="Add with more options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      {showQuick && (
        <div className="absolute z-10 mt-2 w-full max-w-md rounded-lg border border-black/10 bg-white/95 p-3 shadow-xl dark:border-white/10 dark:bg-neutral-900/95">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              className="flex-1 rounded border border-black/10 bg-transparent px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:focus:ring-white/20"
              placeholder="Task title"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (!quickTitle.trim()) return;
                  create.mutate({ title: quickTitle.trim() });
                }
                if (e.key === "Escape") setShowQuick(false);
              }}
            />
            <Button
              onClick={() => {
                if (!quickTitle.trim()) return;
                create.mutate({ title: quickTitle.trim() });
              }}
              disabled={create.isPending}
            >
              Create
            </Button>
            <Button variant="secondary" onClick={() => setShowQuick(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <TaskModal open={showModal} mode="create" onClose={() => setShowModal(false)} />
    </div>
  );
}

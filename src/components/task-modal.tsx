"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { api } from "@/server/api/react";
import { toast } from "react-hot-toast";
import { formatLocalDateTime, parseLocalDateTime, defaultEndOfToday } from "@/lib/datetime";

type BaseTask = {
  id: string;
  title: string;
  subject: string | null;
  notes: string | null;
  dueAt: Date | string | null;
};

interface TaskModalProps {
  open: boolean;
  mode: "create" | "edit";
  onClose: () => void;
  // For edit mode, pass the task snapshot
  task?: BaseTask;
  initialTitle?: string;
  initialDueAt?: Date | null;
  onDraftDueChange?: (dueAt: Date | null) => void;
}

export function TaskModal({ open, mode, onClose, task, initialTitle, initialDueAt, onDraftDueChange }: TaskModalProps) {
  const utils = api.useUtils();
  const isEdit = mode === "edit";

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [due, setDue] = useState<string>(""); // datetime-local
  const [dueEnabled, setDueEnabled] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    if (isEdit && task) {
      setTitle(task.title);
      setSubject(task.subject ?? "");
      setNotes(task.notes ?? "");
      const hasDue = task.dueAt != null;
      setDue(hasDue ? formatLocalDateTime(new Date(task.dueAt as any)) : "");
      setDueEnabled(hasDue);
    } else {
      setTitle(initialTitle ?? "");
      setSubject("");
      setNotes("");
      if (initialDueAt) {
        setDueEnabled(true);
        setDue(formatLocalDateTime(new Date(initialDueAt)));
      } else {
        setDue("");
        setDueEnabled(false);
      }
    }
  }, [open, isEdit, task, initialTitle, initialDueAt]);

  const create = api.task.create.useMutation({
    onSuccess: async () => {
      await utils.task.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message || "Failed to create task"),
  });

  const update = api.task.update.useMutation({
    onSuccess: async () => {
      await utils.task.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message || "Failed to update task"),
  });

  const del = api.task.delete.useMutation({
    onSuccess: async () => {
      await utils.task.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message || "Failed to delete task"),
  });

  const footer = useMemo(
    () => (
      <>
        {isEdit && task && (
          <Button
            variant="danger"
            className="mr-auto"
            onClick={() => del.mutate({ id: task.id })}
          >
            Delete
          </Button>
        )}
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={create.isPending || update.isPending}
          onClick={() => {
            const dueAt = dueEnabled && due ? parseLocalDateTime(due) : null;
            if (isEdit && task) {
              update.mutate({
                id: task.id,
                title: title.trim() || task.title,
                subject: subject.trim() || null,
                notes: notes.trim() || null,
                dueAt,
              });
            } else {
              if (!title.trim()) {
                toast.error("Title is required");
                return;
              }
              create.mutate({ title: title.trim(), subject: subject || undefined, notes: notes || undefined, dueAt });
            }
          }}
        >
          {isEdit ? "Save" : "Create"}
        </Button>
      </>
    ),
    [isEdit, task, title, subject, notes, due, dueEnabled, create.isPending, update.isPending]
  );

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Task" : "New Task"} footer={footer}>
      <div className="grid grid-cols-1 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide opacity-60">Title</span>
          <input
            className="rounded border border-black/10 bg-transparent px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:focus:ring-white/20"
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide opacity-60">Subject</span>
            <input
              className="rounded border border-black/10 bg-transparent px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:focus:ring-white/20"
              placeholder="e.g., Math, CS, English"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-60">
              <input
                type="checkbox"
                className="accent-black dark:accent-white"
                checked={dueEnabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setDueEnabled(enabled);
                  if (enabled && !due) {
                    const v = defaultEndOfToday();
                    setDue(v);
                    onDraftDueChange?.(parseLocalDateTime(v));
                  }
                  if (!enabled) onDraftDueChange?.(null);
                }}
              />
              Set due date
            </label>
            <input
              type="datetime-local"
              className="rounded border border-black/10 bg-transparent px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 disabled:opacity-50 dark:border-white/10 dark:focus:ring-white/20"
              value={due}
              onChange={(e) => {
                setDue(e.target.value);
                onDraftDueChange?.(e.target.value ? parseLocalDateTime(e.target.value) : null);
              }}
              disabled={!dueEnabled}
            />
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide opacity-60">Notes</span>
          <textarea
            rows={4}
            className="resize-none rounded border border-black/10 bg-transparent px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:focus:ring-white/20"
            placeholder="Optional details…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </div>
    </Modal>
  );
}

export default TaskModal;

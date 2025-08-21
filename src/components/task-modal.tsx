"use client";
import React, { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { StatusDropdown } from "@/components/status-dropdown";
import { api } from "@/server/api/react";
import { toast } from "react-hot-toast";
import { formatLocalDateTime, parseLocalDateTime, defaultEndOfToday } from "@/lib/datetime";

import type { RouterOutputs } from "@/server/api/root";

type Task = RouterOutputs["task"]["list"][number];

interface TaskModalProps {
  open: boolean;
  mode: "create" | "edit";
  onClose: () => void;
  // For edit mode, pass the task snapshot
  task?: Task;
  initialTitle?: string;
  initialDueAt?: Date | null;
  onDraftDueChange?: (dueAt: Date | null) => void;
}

export function TaskModal({ open, mode, onClose, task, initialTitle, initialDueAt, onDraftDueChange }: TaskModalProps) {
  const utils = api.useUtils();
  const isEdit = mode === "edit";
  const apiAny = api as any;

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [due, setDue] = useState<string>(""); // datetime-local
  const [dueEnabled, setDueEnabled] = useState<boolean>(false);
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [recurrenceType, setRecurrenceType] = useState<'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'>('NONE');
  const [recurrenceInterval, setRecurrenceInterval] = useState<number>(1);
  const { data: projects = [] } = api.project.list.useQuery();
  const { data: courses = [] } = api.course.list.useQuery();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (isEdit && task) {
      setTitle(task.title);
      setSubject(task.subject ?? "");
      setNotes(task.notes ?? "");
      setPriority(task.priority ?? "MEDIUM");
      setRecurrenceType(task.recurrenceType ?? 'NONE');
      setRecurrenceInterval(task.recurrenceInterval ?? 1);
      setProjectId(task.projectId ?? null);
      setCourseId(task.courseId ?? null);
      const hasDue = task.dueAt != null;
      setDue(hasDue ? formatLocalDateTime(new Date(task.dueAt!)) : "");
      setDueEnabled(hasDue);
    } else {
      setTitle(initialTitle ?? "");
      setSubject("");
      setNotes("");
      setPriority("MEDIUM");
      setRecurrenceType('NONE');
      setRecurrenceInterval(1);
      setProjectId(null);
      setCourseId(null);
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

  const setStatus = apiAny.task?.setStatus?.useMutation?.({
    onSuccess: async () => {
      await utils.task.list.invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Failed to update status"),
  }) ?? { mutate: () => {}, isPending: false };

  const del = api.task.delete.useMutation({
    onSuccess: async () => {
      await utils.task.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message || "Failed to delete task"),
  });

  const footer = (
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
              priority,
              recurrenceType,
              recurrenceInterval,
              projectId,
              courseId,
            });
          } else {
            if (!title.trim()) {
              toast.error("Title is required");
              return;
            }
            create.mutate({
              title: title.trim(),
              subject: subject || undefined,
              notes: notes || undefined,
              dueAt,
              priority,
              recurrenceType,
              recurrenceInterval,
              projectId: projectId || undefined,
              courseId: courseId || undefined,
            });
          }
        }}
      >
        {isEdit ? "Save" : "Create"}
      </Button>
    </>
  );

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Task" : "New Task"} footer={footer}>
      <div className="grid grid-cols-1 gap-3">
        {isEdit && task && (
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide opacity-60">Status</span>
            <StatusDropdown
              value={task.status ?? "TODO"}
              onChange={(next) => {
                setStatus.mutate({ id: task.id, status: next });
                if (next === "DONE") onClose();
              }}
            />
          </div>
        )}
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide opacity-60">Project</span>
            <select
              className="rounded border border-black/10 bg-transparent px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:focus:ring-white/20"
              value={projectId ?? ""}
              onChange={(e) => setProjectId(e.target.value || null)}
            >
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide opacity-60">Course</span>
            <select
              className="rounded border border-black/10 bg-transparent px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:focus:ring-white/20"
              value={courseId ?? ""}
              onChange={(e) => setCourseId(e.target.value || null)}
            >
              <option value="">None</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide opacity-60">Priority</span>
          <select
            className="rounded border border-black/10 bg-transparent px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:focus:ring-white/20"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Task["priority"])}
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </label>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide opacity-60">Recurrence</span>
            <select
              className="rounded border border-black/10 bg-transparent px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:focus:ring-white/20"
              value={recurrenceType}
              onChange={(e) => setRecurrenceType(e.target.value as typeof recurrenceType)}
            >
              <option value="NONE">None</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </label>
          {recurrenceType !== 'NONE' && (
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide opacity-60">Interval</span>
              <input
                type="number"
                min={1}
                className="rounded border border-black/10 bg-transparent px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:focus:ring-white/20"
                value={recurrenceInterval}
                onChange={(e) => setRecurrenceInterval(parseInt(e.target.value, 10) || 1)}
              />
            </label>
          )}
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

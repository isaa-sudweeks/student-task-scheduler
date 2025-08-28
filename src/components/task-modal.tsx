"use client";
import React, { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { StatusDropdown } from "@/components/status-dropdown";
import { api } from "@/server/api/react";
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
  const [recurrenceCount, setRecurrenceCount] = useState<number | ''>('');
  const [recurrenceUntil, setRecurrenceUntil] = useState<string>('');
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
      setRecurrenceCount((task as any).recurrenceCount ?? '');
      setRecurrenceUntil(
        (task as any).recurrenceUntil ? new Date((task as any).recurrenceUntil).toISOString().slice(0, 10) : ''
      );
      setProjectId((task as any).projectId ?? null);
      setCourseId((task as any).courseId ?? null);
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
      setRecurrenceCount('');
      setRecurrenceUntil('');
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
  });

  const update = api.task.update.useMutation({
    onSuccess: async () => {
      await utils.task.list.invalidate();
      onClose();
    },
  });

  const setStatus = apiAny.task?.setStatus?.useMutation?.({
    onSuccess: async () => {
      await utils.task.list.invalidate();
    },
  }) ?? { mutate: () => {}, isPending: false, error: undefined };

  const del = api.task.delete.useMutation({
    onSuccess: async () => {
      await utils.task.list.invalidate();
      onClose();
    },
  });

  if (create.error) throw create.error;
  if (update.error) throw update.error;
  if (setStatus.error) throw setStatus.error;
  if (del.error) throw del.error;

  const footer = (
    <>
      {isEdit && task && (
        <Button
          variant="destructive"
          className="mr-auto"
          onClick={() => del.mutate({ id: task.id })}
        >
          Delete
        </Button>
      )}
      <Button variant="tertiary" onClick={onClose}>
        Cancel
      </Button>
      <Button
        disabled={create.isPending || update.isPending}
        onClick={() => {
          const dueAt = dueEnabled && due ? parseLocalDateTime(due) : null;
          const recurrenceUntilDate =
            recurrenceUntil ? new Date(`${recurrenceUntil}T23:59:59`) : undefined;
          const recurrenceCountVal =
            recurrenceCount === '' ? undefined : recurrenceCount;
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
              recurrenceCount: recurrenceCountVal,
              recurrenceUntil: recurrenceUntilDate,
              projectId,
              courseId,
            });
          } else {
            if (!title.trim()) {
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
              recurrenceCount: recurrenceCountVal,
              recurrenceUntil: recurrenceUntilDate,
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
      <div className="flex flex-col gap-6">
        {isEdit && task && (
          <div className="flex items-center gap-4">
            <span className="w-28 text-sm font-medium">Status</span>
            <StatusDropdown
              value={task.status ?? "TODO"}
              onChange={(next) => {
                setStatus.mutate({ id: task.id, status: next });
                if (next === "DONE") onClose();
              }}
            />
          </div>
        )}
        <div className="flex items-center gap-4">
          <label htmlFor="title" className="w-28 text-sm font-medium">
            Title
          </label>
          <input
            id="title"
            className="flex-1 rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
  
        <div className="flex items-center gap-4">
          <label htmlFor="subject" className="w-28 text-sm font-medium">
            Subject
          </label>
          <input
            id="subject"
            className="flex-1 rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
            placeholder="e.g., Math, CS, English"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4">
          <span className="w-28 text-sm font-medium">Due date</span>
          <div className="flex flex-1 items-center gap-2">
            <input
              id="due-enabled"
              type="checkbox"
              className="accent-black dark:accent-white"
              checked={dueEnabled}
              aria-label="Set due date"
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
            <input
              id="due"
              type="datetime-local"
              className="flex-1 rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50 dark:border-white/10"
              value={due}
              onChange={(e) => {
                setDue(e.target.value);
                onDraftDueChange?.(e.target.value ? parseLocalDateTime(e.target.value) : null);
              }}
              disabled={!dueEnabled}
            />
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <label htmlFor="project" className="w-28 text-sm font-medium">
            Project
          </label>
          <select
            id="project"
            className="flex-1 rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
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
        </div>
        <div className="flex items-center gap-4">
          <label htmlFor="course" className="w-28 text-sm font-medium">
            Course
          </label>
          <select
            id="course"
            className="flex-1 rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
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
        </div>
        <div className="flex items-center gap-4">
          <label htmlFor="priority" className="w-28 text-sm font-medium">
            Priority
          </label>
          <select
            id="priority"
            className="flex-1 rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Task["priority"])}
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </div>

        <div className="flex items-center gap-4">
          <label htmlFor="recurrenceType" className="w-28 text-sm font-medium">
            Recurrence
          </label>
          <select
            id="recurrenceType"
            className="flex-1 rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
            value={recurrenceType}
            onChange={(e) => setRecurrenceType(e.target.value as typeof recurrenceType)}
          >
            <option value="NONE">None</option>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
          </select>
        </div>
        {recurrenceType !== 'NONE' && (
          <div className="flex items-center gap-4">
            <label htmlFor="recurrenceInterval" className="w-28 text-sm font-medium">
              Interval
            </label>
            <input
              id="recurrenceInterval"
              type="number"
              min={1}
              className="flex-1 rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
              value={recurrenceInterval}
              onChange={(e) => setRecurrenceInterval(parseInt(e.target.value, 10) || 1)}
            />
          </div>
        )}

        {recurrenceType !== 'NONE' && (
          <>
            <div className="flex items-center gap-4">
              <label htmlFor="recurrenceCount" className="w-28 text-sm font-medium">
                End after
              </label>
              <input
                id="recurrenceCount"
                type="number"
                min={1}
                className="flex-1 rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
                value={recurrenceCount}
                onChange={(e) =>
                  setRecurrenceCount(e.target.value ? parseInt(e.target.value, 10) : '')
                }
              />
            </div>
            <div className="flex items-center gap-4">
              <label htmlFor="recurrenceUntil" className="w-28 text-sm font-medium">
                End on
              </label>
              <input
                id="recurrenceUntil"
                type="date"
                className="flex-1 rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
                value={recurrenceUntil}
                onChange={(e) => setRecurrenceUntil(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="flex items-start gap-4">
          <label htmlFor="notes" className="w-28 text-sm font-medium">
            Notes
          </label>
          <textarea
            id="notes"
            rows={4}
            className="flex-1 resize-none rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
            placeholder="Optional details…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}

export default TaskModal;

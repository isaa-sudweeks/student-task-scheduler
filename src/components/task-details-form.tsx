"use client";
import React from "react";
import { defaultEndOfToday, parseLocalDateTime } from "@/lib/datetime";

interface TaskDetailsFormProps {
  title: string;
  onTitleChange: (value: string) => void;
  titleError: string | null;
  subject: string;
  onSubjectChange: (value: string) => void;
  due: string;
  dueEnabled: boolean;
  onDueEnabledChange: (enabled: boolean) => void;
  onDueChange: (value: string) => void;
  projectId: string | null;
  onProjectChange: (id: string | null) => void;
  projects: { id: string; title: string }[];
  courseId: string | null;
  onCourseChange: (id: string | null) => void;
  courses: { id: string; title: string }[];
  priority: "LOW" | "MEDIUM" | "HIGH";
  onPriorityChange: (p: "LOW" | "MEDIUM" | "HIGH") => void;
  notes: string;
  onNotesChange: (value: string) => void;
  recurrenceControls?: React.ReactNode;
  onDraftDueChange?: (due: Date | null) => void;
}

export function TaskDetailsForm({
  title,
  onTitleChange,
  titleError,
  subject,
  onSubjectChange,
  due,
  dueEnabled,
  onDueEnabledChange,
  onDueChange,
  projectId,
  onProjectChange,
  projects,
  courseId,
  onCourseChange,
  courses,
  priority,
  onPriorityChange,
  notes,
  onNotesChange,
  recurrenceControls,
  onDraftDueChange,
}: TaskDetailsFormProps) {
  return (
    <>
      <div className="flex items-center gap-4">
        <label htmlFor="title" className="w-28 text-sm font-medium">
          Title
        </label>
        <div className="flex-1">
          <input
            id="title"
            className="w-full rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
            placeholder="Task title"
            value={title}
            onChange={(e) => {
              onTitleChange(e.target.value);
            }}
          />
          {titleError && (
            <p className="mt-1 text-sm text-red-600">{titleError}</p>
          )}
        </div>
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
          onChange={(e) => onSubjectChange(e.target.value)}
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
              onDueEnabledChange(enabled);
              if (enabled && !due) {
                const v = defaultEndOfToday();
                onDueChange(v);
                const parsed = parseLocalDateTime(v);
                onDraftDueChange?.(parsed);
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
              onDueChange(e.target.value);
              const parsed = e.target.value ? parseLocalDateTime(e.target.value) : null;
              onDraftDueChange?.(parsed);
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
          onChange={(e) => onProjectChange(e.target.value || null)}
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
          onChange={(e) => onCourseChange(e.target.value || null)}
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
          onChange={(e) => onPriorityChange(e.target.value as typeof priority)}
        >
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
      </div>

      {recurrenceControls}

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
          onChange={(e) => onNotesChange(e.target.value)}
        />
      </div>
    </>
  );
}

export default TaskDetailsForm;

"use client";
import React from "react";
import { Paperclip } from "lucide-react";

import { defaultEndOfToday, parseLocalDateTime } from "@/lib/datetime";

interface AttachmentSummary {
  id: string;
  name: string;
  url: string;
  size?: number | null;
}

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
  effortMinutes: string;
  onEffortMinutesChange: (value: string) => void;
  gradeScore: string;
  onGradeScoreChange: (value: string) => void;
  gradeScoreError: string | null;
  gradeTotal: string;
  onGradeTotalChange: (value: string) => void;
  gradeTotalError: string | null;
  gradeWeight: string;
  onGradeWeightChange: (value: string) => void;
  gradeWeightError: string | null;
  recurrenceControls?: React.ReactNode;
  onDraftDueChange?: (due: Date | null) => void;
  existingAttachments: AttachmentSummary[];
  pendingAttachments: File[];
  onAttachmentSelect: (files: FileList | null) => void;
  onRemovePendingAttachment: (index: number) => void;
  attachmentError: string | null;
  attachmentInputKey: number;
  isUploadingAttachments: boolean;
}

const formatFileSize = (bytes: number | null | undefined) => {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  const display = value >= 10 || idx === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${display} ${units[idx]}`;
};

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
  effortMinutes,
  onEffortMinutesChange,
  gradeScore,
  onGradeScoreChange,
  gradeScoreError,
  gradeTotal,
  onGradeTotalChange,
  gradeTotalError,
  gradeWeight,
  onGradeWeightChange,
  gradeWeightError,
  recurrenceControls,
  onDraftDueChange,
  existingAttachments,
  pendingAttachments,
  onAttachmentSelect,
  onRemovePendingAttachment,
  attachmentError,
  attachmentInputKey,
  isUploadingAttachments,
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
        <label htmlFor="effortMinutes" className="w-28 text-sm font-medium">
          Estimated effort (minutes)
        </label>
        <input
          id="effortMinutes"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          className="flex-1 rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
          placeholder="e.g., 45"
          value={effortMinutes}
          onChange={(e) => onEffortMinutesChange(e.target.value)}
        />
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

      <div className="space-y-3 rounded-md border border-black/10 p-3 dark:border-white/10">
        <p className="text-sm font-medium">Grading</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="grade-score" className="text-sm">
              Score
            </label>
            <input
              id="grade-score"
              type="number"
              inputMode="decimal"
              min={0}
              className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
              placeholder="e.g., 45"
              value={gradeScore}
              onChange={(e) => onGradeScoreChange(e.target.value)}
            />
            {gradeScoreError && (
              <p className="text-sm text-red-500">{gradeScoreError}</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="grade-total" className="text-sm">
              Total points
            </label>
            <input
              id="grade-total"
              type="number"
              inputMode="decimal"
              min={0}
              className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
              placeholder="e.g., 50"
              value={gradeTotal}
              onChange={(e) => onGradeTotalChange(e.target.value)}
            />
            {gradeTotalError && (
              <p className="text-sm text-red-500">{gradeTotalError}</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="grade-weight" className="text-sm">
              Weight
            </label>
            <input
              id="grade-weight"
              type="number"
              inputMode="decimal"
              min={0}
              className="rounded border border-black/10 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10"
              placeholder="Defaults to total"
              value={gradeWeight}
              onChange={(e) => onGradeWeightChange(e.target.value)}
            />
            {gradeWeightError && (
              <p className="text-sm text-red-500">{gradeWeightError}</p>
            )}
          </div>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Leave weight blank to use total points automatically.
        </p>
      </div>

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

      <div className="flex items-start gap-4">
        <label htmlFor="attachments" className="w-28 text-sm font-medium">
          Attachments
        </label>
        <div className="flex-1 space-y-2">
          <input
            key={attachmentInputKey}
            id="attachments"
            type="file"
            multiple
            className="block w-full text-sm text-neutral-600 file:mr-4 file:rounded file:border file:border-black/10 file:bg-white file:px-3 file:py-1 file:text-sm file:font-medium hover:file:bg-neutral-100 dark:file:border-white/10 dark:file:bg-neutral-900 dark:file:text-neutral-100"
            onChange={(event) => onAttachmentSelect(event.target.files)}
          />
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            PDF and image files up to 10&nbsp;MB upload after you save the task.
          </p>
          {pendingAttachments.length > 0 && (
            <div>
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                Pending upload
              </p>
              <ul className="mt-1 space-y-1 text-sm text-neutral-600 dark:text-neutral-300">
                {pendingAttachments.map((file, index) => (
                  <li
                    key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                    className="flex items-center gap-2"
                  >
                    <Paperclip className="h-3 w-3 text-neutral-400 dark:text-neutral-500" />
                    <span className="flex-1 truncate" title={file.name}>
                      {file.name}
                      {formatFileSize(file.size) ? (
                        <span className="ml-2 text-xs text-neutral-400 dark:text-neutral-500">
                          ({formatFileSize(file.size)})
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline dark:text-red-400"
                      onClick={() => onRemovePendingAttachment(index)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {existingAttachments.length > 0 && (
            <div>
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                Attached files
              </p>
              <ul className="mt-1 space-y-1 text-sm">
                {existingAttachments.map((attachment) => (
                  <li key={attachment.id}>
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-2 text-indigo-600 hover:text-indigo-500 hover:underline dark:text-indigo-300 dark:hover:text-indigo-200"
                    >
                      <Paperclip className="h-3 w-3" />
                      <span className="truncate" title={attachment.name}>
                        {attachment.name}
                        {formatFileSize(attachment.size ?? null) ? (
                          <span className="ml-2 text-xs text-neutral-400 dark:text-neutral-500">
                            ({formatFileSize(attachment.size ?? null)})
                          </span>
                        ) : null}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {attachmentError && (
            <p className="text-sm text-red-600 dark:text-red-400">{attachmentError}</p>
          )}
          {isUploadingAttachments && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Uploading attachments…
            </p>
          )}
        </div>
      </div>
    </>
  );
}

export default TaskDetailsForm;

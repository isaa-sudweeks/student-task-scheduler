"use client";
import React, { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { StatusDropdown } from "@/components/status-dropdown";
import { api } from "@/server/api/react";
import { formatLocalDateTime, parseLocalDateTime } from "@/lib/datetime";
import TaskDetailsForm from "./task-details-form";
import RecurrenceControls from "./recurrence-controls";
import SubtaskList from "./subtask-list";

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
  initialProjectId?: string | null;
  initialCourseId?: string | null;
}

export function TaskModal({
  open,
  mode,
  onClose,
  task,
  initialTitle,
  initialDueAt,
  onDraftDueChange,
  initialProjectId,
  initialCourseId,
}: TaskModalProps) {
  const utils = api.useUtils();
  const isEdit = mode === "edit";

  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [subject, setSubject] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [due, setDue] = useState<string>(""); // datetime-local
  const [dueEnabled, setDueEnabled] = useState<boolean>(false);
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [recurrenceType, setRecurrenceType] = useState<'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'>('NONE');
  const [recurrenceInterval, setRecurrenceInterval] = useState<number>(1);
  const [recurrenceCount, setRecurrenceCount] = useState<number | ''>('');
  const [recurrenceUntil, setRecurrenceUntil] = useState<string>('');
  const recurrenceConflict = recurrenceCount !== '' && recurrenceUntil !== '';
  const { data: projects = [] } = api.project.list.useQuery();
  const { data: courses = [] } = api.course.list.useQuery({ page: 1, limit: 100 });
  const [projectId, setProjectId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [subtaskTitle, setSubtaskTitle] = useState('');

  const { data: subtasks = [] } = api.task.list.useQuery(
    { filter: 'all', parentId: task?.id },
    { enabled: isEdit && !!task }
  );

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
      setProjectId(initialProjectId ?? null);
      setCourseId(initialCourseId ?? null);
      if (initialDueAt) {
        setDueEnabled(true);
        setDue(formatLocalDateTime(new Date(initialDueAt)));
      } else {
        setDue("");
        setDueEnabled(false);
      }
    }
    setTitleError(null);
  }, [open, isEdit, task, initialTitle, initialDueAt, initialProjectId, initialCourseId]);

  const create = api.task.create.useMutation({
    onSuccess: async () => {
      await utils.task.list.invalidate();
      onClose();
    },
  });

  const createSubtask = api.task.create.useMutation({
    onSuccess: async () => {
      await utils.task.list.invalidate();
      setSubtaskTitle('');
    },
  });

  const update = api.task.update.useMutation({
    onSuccess: async () => {
      await utils.task.list.invalidate();
      onClose();
    },
  });

  const setStatus = api.task.setStatus.useMutation({
    onSuccess: async () => {
      await utils.task.list.invalidate();
    },
  });

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
  if (createSubtask.error) throw createSubtask.error;

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
        disabled={create.isPending || update.isPending || recurrenceConflict}
        onClick={() => {
          if (recurrenceConflict) return;
          const parsedDue = parseLocalDateTime(due);
          const dueAt = dueEnabled && parsedDue ? parsedDue : null;
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
              setTitleError("Title is required");
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
        <TaskDetailsForm
          title={title}
          onTitleChange={(v) => {
            setTitle(v);
            if (titleError) setTitleError(null);
          }}
          titleError={titleError}
          subject={subject}
          onSubjectChange={setSubject}
          due={due}
          dueEnabled={dueEnabled}
          onDueEnabledChange={setDueEnabled}
          onDueChange={setDue}
          projectId={projectId}
          onProjectChange={setProjectId}
          projects={projects}
          courseId={courseId}
          onCourseChange={setCourseId}
          courses={courses}
          priority={priority}
          onPriorityChange={setPriority}
          notes={notes}
          onNotesChange={setNotes}
          onDraftDueChange={onDraftDueChange}
          recurrenceControls={
            <RecurrenceControls
              recurrenceType={recurrenceType}
              onRecurrenceTypeChange={setRecurrenceType}
              recurrenceInterval={recurrenceInterval}
              onRecurrenceIntervalChange={setRecurrenceInterval}
              recurrenceCount={recurrenceCount}
              onRecurrenceCountChange={setRecurrenceCount}
              recurrenceUntil={recurrenceUntil}
              onRecurrenceUntilChange={setRecurrenceUntil}
            />
          }
        />
        {isEdit && task && (
          <SubtaskList
            subtasks={subtasks}
            subtaskTitle={subtaskTitle}
            onSubtaskTitleChange={setSubtaskTitle}
            onAdd={() =>
              task &&
              createSubtask.mutate({ title: subtaskTitle, parentId: task.id })
            }
            disabled={createSubtask.isPending}
          />
        )}
      </div>
    </Modal>
  );
}

export default TaskModal;

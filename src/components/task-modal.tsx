"use client";
import React, { useEffect, useMemo, useState } from "react";
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
type Reminder = RouterOutputs["task"]["listReminders"][number];
type ReminderChannel = Reminder["channel"];

const reminderChannels: ReminderChannel[] = ["EMAIL", "PUSH", "SMS"];
const MAX_REMINDERS = 5;

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
  const [effortMinutes, setEffortMinutes] = useState<string>('');
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [reminders, setReminders] = useState<Array<{ id?: string; channel: ReminderChannel; offset: string }>>([
    { channel: "EMAIL", offset: "60" },
  ]);
  const [reminderError, setReminderError] = useState<string | null>(null);

  const { data: subtasks = [] } = api.task.list.useQuery(
    { filter: 'all', parentId: task?.id },
    { enabled: isEdit && !!task }
  );

  const remindersQuery = api.task.listReminders.useQuery(
    { taskId: task?.id ?? "" },
    { enabled: isEdit && !!task && open },
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
      setEffortMinutes(task.effortMinutes != null ? String(task.effortMinutes) : '');
      const hasDue = task.dueAt != null;
      setDue(hasDue ? formatLocalDateTime(new Date(task.dueAt!)) : "");
      setDueEnabled(hasDue);
      if (remindersQuery.data) {
        setReminders(remindersQuery.data.map((reminder) => ({
          id: reminder.id,
          channel: reminder.channel,
          offset: reminder.offsetMin.toString(),
        })));
      } else {
        setReminders([]);
      }
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
      setEffortMinutes('');
      if (initialDueAt) {
        setDueEnabled(true);
        setDue(formatLocalDateTime(new Date(initialDueAt)));
      } else {
        setDue("");
        setDueEnabled(false);
      }
      setReminders([{ channel: "EMAIL", offset: "60" }]);
    }
    setTitleError(null);
    setReminderError(null);
  }, [
    open,
    isEdit,
    task,
    initialTitle,
    initialDueAt,
    initialProjectId,
    initialCourseId,
    remindersQuery.data,
  ]);

  const create = api.task.create.useMutation();

  const createSubtask = api.task.create.useMutation({
    onSuccess: async () => {
      await utils.task.list.invalidate();
      setSubtaskTitle('');
    },
  });

  const update = api.task.update.useMutation();

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

  const replaceReminders = api.task.replaceReminders.useMutation();

  if (create.error) throw create.error;
  if (update.error) throw update.error;
  if (setStatus.error) throw setStatus.error;
  if (del.error) throw del.error;
  if (createSubtask.error) throw createSubtask.error;
  if (replaceReminders.error) throw replaceReminders.error;

  const parsedReminders = useMemo(() => {
    const sanitized = reminders
      .map((reminder) => ({
        id: reminder.id,
        channel: reminder.channel,
        offsetMin: Number(reminder.offset.trim()),
        rawOffset: reminder.offset,
      }))
      .filter((reminder) => reminder.rawOffset !== "");
    return sanitized;
  }, [reminders]);

  const reminderValidationError = useMemo(() => {
    if (parsedReminders.length !== reminders.length && reminders.some((r) => r.offset.trim() === "")) {
      return "Fill in the lead time for each reminder or remove unused rows.";
    }
    for (const reminder of parsedReminders) {
      if (Number.isNaN(reminder.offsetMin)) return "Lead time must be a number.";
      if (reminder.offsetMin < 0) return "Lead time must be zero or greater.";
      if (reminder.offsetMin > 10080) return "Lead time cannot exceed one week.";
    }
    if (parsedReminders.length > MAX_REMINDERS) return `You can only add up to ${MAX_REMINDERS} reminders.`;
    return null;
  }, [parsedReminders, reminders]);

  const handleSave = async () => {
    if (recurrenceConflict) return;
    if (reminderValidationError) {
      setReminderError(reminderValidationError);
      return;
    }

    const parsedDue = parseLocalDateTime(due);
    const dueAt = dueEnabled && parsedDue ? parsedDue : null;
    const isRecurring = recurrenceType !== 'NONE';
    const recurrenceUntilDate =
      isRecurring && recurrenceUntil ? new Date(`${recurrenceUntil}T23:59:59`) : undefined;
    const recurrenceCountVal =
      isRecurring && recurrenceCount !== '' ? recurrenceCount : undefined;
    const recurringFields = isRecurring
      ? {
          recurrenceType,
          recurrenceInterval,
          ...(recurrenceCountVal !== undefined ? { recurrenceCount: recurrenceCountVal } : {}),
          ...(recurrenceUntilDate ? { recurrenceUntil: recurrenceUntilDate } : {}),
        }
      : {};
    const recurringUpdateFields = isRecurring
      ? {
          recurrenceType,
          recurrenceInterval,
          ...(recurrenceCountVal !== undefined
            ? { recurrenceCount: recurrenceCountVal }
            : { recurrenceCount: null }),
          ...(recurrenceUntilDate
            ? { recurrenceUntil: recurrenceUntilDate }
            : { recurrenceUntil: null }),
        }
      : { recurrenceType: 'NONE' as const, recurrenceCount: null, recurrenceUntil: null };
    const trimmedEffort = effortMinutes.trim();
    const hasEffort = trimmedEffort.length > 0;
    const parsedEffort = hasEffort ? Number.parseInt(trimmedEffort, 10) : undefined;
    const createEffort =
      typeof parsedEffort === "number" && !Number.isNaN(parsedEffort) ? parsedEffort : undefined;
    const updateEffort =
      typeof parsedEffort === "number" && !Number.isNaN(parsedEffort) ? parsedEffort : null;

    if (!isEdit && !title.trim()) {
      setTitleError("Title is required");
      return;
    }

    let saved: { id: string };
    if (isEdit && task) {
      saved = await update.mutateAsync({
        id: task.id,
        title: title.trim() || task.title,
        subject: subject.trim() || null,
        notes: notes.trim() || null,
        dueAt,
        priority,
        ...recurringUpdateFields,
        projectId,
        courseId,
        effortMinutes: updateEffort,
      });
    } else {
      saved = await create.mutateAsync({
        title: title.trim(),
        subject: subject.trim() || undefined,
        notes: notes.trim() || undefined,
        dueAt,
        priority,
        ...recurringFields,
        projectId: projectId || undefined,
        courseId: courseId || undefined,
        ...(typeof createEffort !== "undefined" ? { effortMinutes: createEffort } : {}),
      }) as Task;
    }

    const reminderPayload = parsedReminders.map((reminder) => ({
      channel: reminder.channel,
      offsetMin: reminder.offsetMin,
    }));

    await replaceReminders.mutateAsync({
      taskId: saved.id,
      reminders: reminderPayload,
    });

    await utils.task.list.invalidate();
    await utils.task.listReminders.invalidate({ taskId: saved.id });
    onClose();
  };

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
        disabled={
          create.isPending ||
          update.isPending ||
          replaceReminders.isPending ||
          recurrenceConflict
        }
        onClick={() => void handleSave()}
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
          effortMinutes={effortMinutes}
          onEffortMinutesChange={setEffortMinutes}
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
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Reminders</span>
            <Button
              variant="secondary"
              className="px-3 py-1 text-sm"
              disabled={reminders.length >= MAX_REMINDERS}
              onClick={() => {
                setReminders((prev) => [
                  ...prev,
                  { channel: "EMAIL", offset: "" },
                ]);
                setReminderError(null);
              }}
            >
              Add reminder
            </Button>
          </div>
          {reminders.length === 0 && <p className="text-sm text-muted-foreground">No reminders configured.</p>}
          <div className="flex flex-col gap-2">
            {reminders.map((reminder, index) => (
              <div key={reminder.id ?? index} className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor={`reminder-channel-${index}`}>
                  Reminder channel {index + 1}
                </label>
                <select
                  id={`reminder-channel-${index}`}
                  className="rounded border border-input bg-background px-2 py-1 text-sm"
                  value={reminder.channel}
                  onChange={(event) => {
                    const next = event.target.value as ReminderChannel;
                    setReminders((prev) =>
                      prev.map((item, idx) =>
                        idx === index ? { ...item, channel: next } : item,
                      ),
                    );
                    setReminderError(null);
                  }}
                >
                  {reminderChannels.map((channel) => (
                    <option key={channel} value={channel}>
                      {channel === "EMAIL"
                        ? "Email"
                        : channel === "PUSH"
                        ? "Push notification"
                        : "SMS"}
                    </option>
                  ))}
                </select>
                <label className="sr-only" htmlFor={`reminder-offset-${index}`}>
                  Reminder lead time {index + 1}
                </label>
                <input
                  id={`reminder-offset-${index}`}
                  type="number"
                  min={0}
                  max={10080}
                  className="w-24 rounded border border-input bg-background px-2 py-1 text-sm"
                  value={reminder.offset}
                  onChange={(event) => {
                    const value = event.target.value;
                    setReminders((prev) =>
                      prev.map((item, idx) =>
                        idx === index ? { ...item, offset: value } : item,
                      ),
                    );
                    setReminderError(null);
                  }}
                />
                <span className="text-sm text-muted-foreground">minutes before</span>
                <Button
                  variant="tertiary"
                  className="px-2 py-1 text-sm"
                  onClick={() => {
                    setReminders((prev) => prev.filter((_, idx) => idx !== index));
                    setReminderError(null);
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
          {(reminderError ?? reminderValidationError) && (
            <p className="text-sm text-destructive">
              {reminderError ?? reminderValidationError}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default TaskModal;

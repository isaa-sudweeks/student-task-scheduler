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
type TaskAttachment = NonNullable<Task["attachments"]>[number];

interface AttachmentViewModel {
  id: string;
  name: string;
  url: string;
  size: number | null;
}

const toAttachmentViewModel = (attachment: TaskAttachment): AttachmentViewModel => ({
  id: attachment.id,
  name: attachment.originalName ?? attachment.fileName,
  url: attachment.url,
  size: attachment.size ?? null,
});

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
  const [existingAttachments, setExistingAttachments] = useState<AttachmentViewModel[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [attachmentInputKey, setAttachmentInputKey] = useState(0);
  const [gradeScore, setGradeScore] = useState("");
  const [gradeTotal, setGradeTotal] = useState("");
  const [gradeWeight, setGradeWeight] = useState("");
  const [gradeScoreError, setGradeScoreError] = useState<string | null>(null);
  const [gradeTotalError, setGradeTotalError] = useState<string | null>(null);
  const [gradeWeightError, setGradeWeightError] = useState<string | null>(null);

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
      setGradeScore(task.gradeScore != null ? String(task.gradeScore) : '');
      setGradeTotal(task.gradeTotal != null ? String(task.gradeTotal) : '');
      setGradeWeight(task.gradeWeight != null ? String(task.gradeWeight) : '');
      const hasDue = task.dueAt != null;
      setDue(hasDue ? formatLocalDateTime(new Date(task.dueAt!)) : "");
      setDueEnabled(hasDue);
      setExistingAttachments((task.attachments ?? []).map(toAttachmentViewModel));
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
      setGradeScore('');
      setGradeTotal('');
      setGradeWeight('');
      if (initialDueAt) {
        setDueEnabled(true);
        setDue(formatLocalDateTime(new Date(initialDueAt)));
      } else {
        setDue("");
        setDueEnabled(false);
      }
      setReminders([{ channel: "EMAIL", offset: "60" }]);
      setExistingAttachments([]);
    }
    setTitleError(null);
    setReminderError(null);
    setPendingAttachments([]);
    setAttachmentError(null);
    setIsUploadingAttachments(false);
    setAttachmentInputKey((key) => key + 1);
    setGradeScoreError(null);
    setGradeTotalError(null);
    setGradeWeightError(null);
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

  useEffect(() => {
    if (!open) {
      setPendingAttachments([]);
      setAttachmentError(null);
      setIsUploadingAttachments(false);
      setAttachmentInputKey((key) => key + 1);
      setExistingAttachments([]);
    }
  }, [open]);

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

  const fileKey = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;

  const handleAttachmentSelect = (fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setPendingAttachments((prev) => {
      const next = [...prev];
      const seen = new Set(next.map(fileKey));
      for (const file of files) {
        const key = fileKey(file);
        if (!seen.has(key)) {
          seen.add(key);
          next.push(file);
        }
      }
      return next;
    });
    setAttachmentError(null);
    setAttachmentInputKey((key) => key + 1);
  };

  const handleRemovePendingAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, idx) => idx !== index));
    setAttachmentError(null);
    setAttachmentInputKey((key) => key + 1);
  };

  const uploadPendingAttachments = async (taskId: string) => {
    const uploaded: AttachmentViewModel[] = [];
    for (const file of pendingAttachments) {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: "POST",
        body: formData,
      });
      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch (error) {
        payload = null;
      }
      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? (payload as { error?: string }).error ?? "Failed to upload attachment"
            : "Failed to upload attachment";
        throw new Error(message);
      }
      if (
        !payload ||
        typeof payload !== "object" ||
        !("attachment" in payload) ||
        typeof (payload as any).attachment !== "object"
      ) {
        throw new Error("Invalid attachment response");
      }
      const record = (payload as { attachment: { id: string; originalName: string; url: string; size: number | null } }).attachment;
      uploaded.push({
        id: record.id,
        name: record.originalName,
        url: record.url,
        size: record.size ?? null,
      });
    }
    return uploaded;
  };

  const handleSave = async () => {
    if (recurrenceConflict) return;
    setGradeScoreError(null);
    setGradeTotalError(null);
    setGradeWeightError(null);
    if (reminderValidationError) {
      setReminderError(reminderValidationError);
      return;
    }
    const trimmedGradeScore = gradeScore.trim();
    const trimmedGradeTotal = gradeTotal.trim();
    const trimmedGradeWeight = gradeWeight.trim();
    let gradeScoreValue: number | null = null;
    let gradeTotalValue: number | null = null;
    let gradeWeightValue: number | null = null;
    let gradeHasError = false;
    if (trimmedGradeScore) {
      const parsed = Number(trimmedGradeScore);
      if (Number.isNaN(parsed) || parsed < 0) {
        setGradeScoreError('Score must be zero or greater.');
        gradeHasError = true;
      } else {
        gradeScoreValue = parsed;
      }
    }
    if (trimmedGradeTotal) {
      const parsed = Number(trimmedGradeTotal);
      if (Number.isNaN(parsed) || parsed <= 0) {
        setGradeTotalError('Total points must be greater than zero.');
        gradeHasError = true;
      } else {
        gradeTotalValue = parsed;
      }
    }
    if (trimmedGradeWeight) {
      const parsed = Number(trimmedGradeWeight);
      if (Number.isNaN(parsed) || parsed <= 0) {
        setGradeWeightError('Weight must be greater than zero.');
        gradeHasError = true;
      } else {
        gradeWeightValue = parsed;
      }
    }
    if (trimmedGradeScore && !trimmedGradeTotal) {
      setGradeTotalError('Provide total points when recording a score.');
      gradeHasError = true;
    }
    if (!trimmedGradeScore && trimmedGradeTotal) {
      setGradeScoreError('Provide a score when setting total points.');
      gradeHasError = true;
    }
    if (gradeHasError) return;

    const gradeScoreForUpdate =
      trimmedGradeScore === '' ? null : gradeScoreValue ?? null;
    const gradeTotalForUpdate =
      trimmedGradeTotal === '' ? null : gradeTotalValue ?? null;
    const gradeWeightForUpdate =
      trimmedGradeWeight === '' ? null : gradeWeightValue ?? null;

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

    setAttachmentError(null);
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
        gradeScore: gradeScoreForUpdate,
        gradeTotal: gradeTotalForUpdate,
        gradeWeight: gradeWeightForUpdate,
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
        ...(trimmedGradeScore
          ? { gradeScore: gradeScoreValue as number }
          : {}),
        ...(trimmedGradeTotal
          ? { gradeTotal: gradeTotalValue as number }
          : {}),
        ...(trimmedGradeWeight
          ? { gradeWeight: gradeWeightValue as number }
          : {}),
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

    if (pendingAttachments.length > 0) {
      setIsUploadingAttachments(true);
      try {
        const uploaded = await uploadPendingAttachments(saved.id);
        if (uploaded.length > 0) {
          setExistingAttachments((prev) => [...prev, ...uploaded]);
        }
        setPendingAttachments([]);
        setAttachmentInputKey((key) => key + 1);
        setAttachmentError(null);
      } catch (error) {
        setAttachmentError(
          error instanceof Error ? error.message : "Failed to upload attachments",
        );
        setIsUploadingAttachments(false);
        await utils.task.list.invalidate();
        await utils.task.listReminders.invalidate({ taskId: saved.id });
        return;
      }
      setIsUploadingAttachments(false);
    }

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
          recurrenceConflict ||
          isUploadingAttachments
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
          gradeScore={gradeScore}
          onGradeScoreChange={(value) => {
            setGradeScore(value);
            if (gradeScoreError) setGradeScoreError(null);
          }}
          gradeScoreError={gradeScoreError}
          gradeTotal={gradeTotal}
          onGradeTotalChange={(value) => {
            setGradeTotal(value);
            if (gradeTotalError) setGradeTotalError(null);
          }}
          gradeTotalError={gradeTotalError}
          gradeWeight={gradeWeight}
          onGradeWeightChange={(value) => {
            setGradeWeight(value);
            if (gradeWeightError) setGradeWeightError(null);
          }}
          gradeWeightError={gradeWeightError}
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
          existingAttachments={existingAttachments}
          pendingAttachments={pendingAttachments}
          onAttachmentSelect={handleAttachmentSelect}
          onRemovePendingAttachment={handleRemovePendingAttachment}
          attachmentError={attachmentError}
          attachmentInputKey={attachmentInputKey}
          isUploadingAttachments={isUploadingAttachments}
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

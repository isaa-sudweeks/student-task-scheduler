"use client";

import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import { api } from "@/server/api/react";
import type { RouterOutputs } from "@/server/api/root";

import { TaskListSkeleton } from "./task-list-skeleton";
import { TaskFilterTabs } from "./task-filter-tabs";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Calendar, Tag, GripVertical } from "lucide-react";
import { TaskModal } from "@/components/task-modal";
import { StatusDropdown, type TaskStatus } from "@/components/status-dropdown";
import { Button } from "@/components/ui/button";

type Task = RouterOutputs["task"]["list"][number];
type Priority = "LOW" | "MEDIUM" | "HIGH";

export function TaskList() {
  const [filter, setFilter] = useState<"all" | "overdue" | "today" | "archive">("all");
  const [subject, setSubject] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [query, setQuery] = useState("");
  const utils = api.useUtils();

  const queryInput = React.useMemo(() => {
    const tzOffsetMinutes = new Date().getTimezoneOffset();
    const now = new Date();
    const startLocal = new Date(now);
    startLocal.setHours(0, 0, 0, 0);
    const endLocal = new Date(now);
    endLocal.setHours(23, 59, 59, 999);
    // Pass both explicit bounds and offset (offset kept for backward compatibility/tests)
    return {
      filter,
      subject: subject ?? undefined,
      priority: priority ?? undefined,
      tzOffsetMinutes,
      todayStart: startLocal,
      todayEnd: endLocal,
    } as const;
  }, [filter, subject, priority]);

  const tasks = api.task.list.useQuery(queryInput);
  // Query archived count for header stats
  const archivedQueryInput = React.useMemo(
    () => ({
      filter: "archive" as const,
      tzOffsetMinutes: queryInput.tzOffsetMinutes,
      todayStart: queryInput.todayStart,
      todayEnd: queryInput.todayEnd,
    }),
    [queryInput]
  );
  const archived = api.task.list.useQuery(archivedQueryInput);
  // Keep a stable snapshot of the fetched tasks for the current filter
  const [taskDataSnapshot, setTaskDataSnapshot] = useState<typeof tasks.data>();
  const prevFilterRef = React.useRef(filter);
  useEffect(() => {
    if (!tasks.data) return;
    // On first data load or when filter changes, capture snapshot
    if (taskDataSnapshot === undefined || prevFilterRef.current !== filter) {
      setTaskDataSnapshot(tasks.data);
      prevFilterRef.current = filter;
      return;
    }
    // If the set of task IDs has changed, refresh snapshot (create/delete)
    const snapIds = new Set((taskDataSnapshot as Task[]).map((t: Task) => t.id));
    const dataIds = new Set((tasks.data as Task[]).map((t: Task) => t.id));
    const idsDiffer =
      snapIds.size !== dataIds.size ||
      [...dataIds].some((id) => !snapIds.has(id));
    if (idsDiffer) {
      setTaskDataSnapshot(tasks.data);
      return;
    }
    // If content changed for existing IDs, refresh snapshot when updatedAt differs
    const snapById = new Map((taskDataSnapshot as Task[]).map((t: Task) => [t.id, t]));
    const contentChanged = (tasks.data as Task[]).some((t: Task) => {
      const prev = snapById.get(t.id);
      if (!(t && prev)) return false;
      // Detect edits via updatedAt change only to avoid noisy re-snapshots in tests
      if (t.updatedAt && prev.updatedAt) {
        const nextTs = new Date(t.updatedAt).getTime();
        const prevTs = new Date(prev.updatedAt).getTime();
        return nextTs !== prevTs;
      }
      return false;
    });
    if (contentChanged) {
      setTaskDataSnapshot(tasks.data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, tasks.data, taskDataSnapshot]);
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    if (tasks.data) {
      setItems((tasks.data as Task[]).map((t: Task) => t.id));
    }
  }, [tasks.data]);

  useEffect(() => {
    setSelected((prev) => new Set([...prev].filter((id) => items.includes(id))));
  }, [items]);

  const totalTasks = tasks.data?.length ?? 0;
  const archivedCount = archived.data?.length ?? 0;

  const setDue = api.task.setDueDate.useMutation({
    onSuccess: async () => utils.task.list.invalidate(),
    onError: (e) => toast.error(e.message || "Failed to set due date"),
  });

  // Inline rename/delete removed in minimalist UI; handled in modal

  const setStatus = api.task.setStatus.useMutation({
    onSuccess: async () => utils.task.list.invalidate(),
    onError: (e) => toast.error(e.message || "Failed to update status"),
  });

  const reorder = api.task.reorder.useMutation({
    onSuccess: async () => utils.task.list.invalidate(),
    onError: (e) => toast.error(e.message || "Failed to reorder tasks"),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      const newItems = arrayMove(prev, oldIndex, newIndex);
      const snapshot = prev;
      reorder.mutate(
        { ids: newItems },
        {
          onError: () => setItems(snapshot),
        }
      );
      return newItems;
    });
  };

  const taskData = taskDataSnapshot ?? tasks.data;
  const orderedTasks = React.useMemo(() => {
    const list = taskData ?? [];
    if (items.length === 0) return list;
    const map = new Map((list as Task[]).map((t: Task) => [t.id, t]));
    return items.map((id) => map.get(id)).filter(Boolean) as Task[];
  }, [taskData, items]);

  const filteredOrderedTasks = React.useMemo(
    () =>
      orderedTasks.filter(
        (t) =>
          t.title.toLowerCase().includes(query.toLowerCase()) &&
          (!subject || t.subject === subject) &&
          (!priority || t.priority === priority)
      ),
    [orderedTasks, query, subject, priority]
  );
  // Compute the visible ids in the current order; feed to SortableContext
  const visibleIds = React.useMemo(
    () => filteredOrderedTasks.map((t) => t.id),
    [filteredOrderedTasks]
  );

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkUpdate = api.task.bulkUpdate.useMutation({
    onSuccess: async () => {
      setSelected(new Set());
      await utils.task.list.invalidate();
    },
    onError: (e) => toast.error(e.message || "Failed to update tasks"),
  });

  const bulkDelete = api.task.bulkDelete.useMutation({
    onSuccess: async () => {
      setSelected(new Set());
      await utils.task.list.invalidate();
    },
    onError: (e) => toast.error(e.message || "Failed to delete tasks"),
  });

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredOrderedTasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
  });
  const useVirtual = filteredOrderedTasks.length >= 20;

  const TaskItem = ({
    t,
    virtualStyle,
  }: {
    t: Task;
    virtualStyle?: React.CSSProperties;
  }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: t.id });
    const style: React.CSSProperties = {
      ...virtualStyle,
      ...(transform ? { transform: CSS.Transform.toString(transform) } : {}),
      ...(transition ? { transition } : {}),
    };
    const overdue = t.dueAt ? new Date(t.dueAt) < new Date() : false;
    const done = t.status === "DONE";
    const priority: Priority = t.priority ?? "MEDIUM";
    const priorityStyles: Record<Priority, string> = {
      HIGH: "bg-red-100 text-red-700 ring-red-200 dark:bg-red-900/30 dark:text-red-200 dark:ring-red-800",
      MEDIUM: "bg-blue-100 text-blue-700 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:ring-blue-800",
      LOW: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700",
    };
    return (
      <li
        ref={setNodeRef}
        style={style}
        {...attributes}
        key={t.id}
        className={`flex items-center justify-between rounded border px-3 py-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${
          overdue
            ? "border-red-500 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"
            : ""
        }`}
        onClick={() => setEditingTask(t)}
      >
        <div className="flex items-start gap-3 flex-1">
          <input
            type="checkbox"
            aria-label="Select task"
            className="mt-1"
            checked={selected.has(t.id)}
            onChange={(e) => {
              e.stopPropagation();
              toggleSelected(t.id);
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            aria-label="Drag to reorder"
            className="mt-0.5 -ml-1 cursor-grab touch-none select-none rounded p-1 text-slate-400 hover:text-slate-600 active:cursor-grabbing dark:text-slate-500 dark:hover:text-slate-300"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <StatusDropdown
            className="mt-0.5"
            value={t.status as TaskStatus}
            onChange={(next) =>
              setStatus.mutate({ id: t.id, status: next })
            }
          />
          <div className="flex flex-col gap-1 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`font-medium ${done ? "line-through opacity-60" : ""}`}>
                {t.title}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${priorityStyles[priority]}`}
              >
                {priority.charAt(0) + priority.slice(1).toLowerCase()}
              </span>
              {t.subject && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
                  <Tag className="h-3 w-3" /> {t.subject}
                </span>
              )}
              {t.dueAt && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
                  overdue
                    ? "bg-red-100 text-red-700 ring-red-200 dark:bg-red-900/30 dark:text-red-200 dark:ring-red-800"
                    : "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800"
                }`}>
                  <Calendar className="h-3 w-3" />
                  {new Date(t.dueAt!).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
        {/* Right side kept minimal on list */}
      </li>
    );
  };

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        placeholder="Search tasks..."
        className="w-full bg-transparent border-0 px-0 py-1 outline-none placeholder:text-muted-foreground"
      />
      <div className="flex items-center justify-between">
        <TaskFilterTabs
          value={filter}
          onChange={setFilter}
          subject={subject}
          onSubjectChange={setSubject}
          priority={priority}
          onPriorityChange={setPriority}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {archivedCount} archived
        </p>
      </div>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleIds}>
          {useVirtual ? (
            <div ref={parentRef} className="overflow-auto max-h-[600px]">
              <div
                style={{
                  height: rowVirtualizer!.getTotalSize(),
                  position: "relative",
                }}
              >
                {rowVirtualizer!.getVirtualItems().map((virtualRow) => {
                  const t = filteredOrderedTasks[virtualRow.index];
                  return (
                    <TaskItem
                      key={t.id}
                      t={t}
                      virtualStyle={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                        height: `${virtualRow.size}px`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {filteredOrderedTasks.map((t) => (
                <TaskItem key={t.id} t={t} />
              ))}
              {tasks.isLoading && <TaskListSkeleton />}
              {!tasks.isLoading && filteredOrderedTasks.length === 0 && (
                <li className="opacity-60">No tasks.</li>
              )}
            </ul>
          )}
        </SortableContext>
        {useVirtual && !tasks.isLoading && filteredOrderedTasks.length === 0 && (
          <div className="opacity-60">No tasks.</div>
        )}
        {useVirtual && tasks.isLoading && <TaskListSkeleton />}
      </DndContext>

      {tasks.error && (
        <p role="alert" className="text-red-500">
          {tasks.error.message}
        </p>
      )}
      {setDue.error && (
        <p role="alert" className="text-red-500">{setDue.error.message}</p>
      )}

      {selected.size > 0 && (
        <div data-testid="bulk-actions" className="flex gap-2">
          <Button
            onClick={() =>
              bulkUpdate.mutate({
                ids: Array.from(selected),
                status: "DONE",
              })
            }
          >
            Mark done
          </Button>
          <Button
            variant="danger"
            onClick={() =>
              bulkDelete.mutate({ ids: Array.from(selected) })
            }
          >
            Delete
          </Button>
        </div>
      )}

      <TaskModal
        open={!!editingTask}
        mode="edit"
        onClose={() => setEditingTask(null)}
        task={editingTask ?? undefined}
      />
    </div>
  );
}

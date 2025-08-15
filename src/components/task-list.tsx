"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import { api } from "@/server/api/react";

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
import { Calendar, Tag, GripVertical } from "lucide-react";
import { TaskModal } from "@/components/task-modal";

export function TaskList() {
  const [filter, setFilter] = useState<"all" | "overdue" | "today">("all");
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
      tzOffsetMinutes,
      todayStart: startLocal,
      todayEnd: endLocal,
    } as const;
  }, [filter]);

  const tasks = api.task.list.useQuery(queryInput);
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
    const snapIds = new Set(taskDataSnapshot.map((t) => t.id));
    const dataIds = new Set(tasks.data.map((t) => t.id));
    const idsDiffer =
      snapIds.size !== dataIds.size ||
      [...dataIds].some((id) => !snapIds.has(id));
    if (idsDiffer) {
      setTaskDataSnapshot(tasks.data);
      return;
    }
    // If content changed for existing IDs, refresh snapshot when updatedAt differs
    const snapById = new Map(taskDataSnapshot.map((t: any) => [t.id, t]));
    const contentChanged = tasks.data.some((t: any) => {
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
      setItems(tasks.data.map((t) => t.id));
    }
  }, [tasks.data]);

  const totalTasks = tasks.data?.length ?? 0;
  const completedTasks = tasks.data?.filter((t) => t.status === "DONE").length ?? 0;

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
      reorder.mutate({ ids: newItems });
      return newItems;
    });
  };

  const taskData = taskDataSnapshot ?? tasks.data;
  const orderedTasks = React.useMemo(() => {
    const list = taskData ?? [];
    if (items.length === 0) return list;
    const map = new Map(list.map((t) => [t.id, t]));
    return items.map((id) => map.get(id)).filter(Boolean) as typeof list;
  }, [taskData, items]);

  const filteredOrderedTasks = React.useMemo(
    () =>
      orderedTasks.filter((t) =>
        t.title.toLowerCase().includes(query.toLowerCase())
      ),
    [orderedTasks, query]
  );
  // Compute the visible ids in the current order; feed to SortableContext
  const visibleIds = React.useMemo(
    () => filteredOrderedTasks.map((t) => t.id),
    [filteredOrderedTasks]
  );

  const [editingTask, setEditingTask] = useState<(typeof orderedTasks)[number] | null>(null);

  const TaskItem = ({ t }: { t: (typeof orderedTasks)[number] }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: t.id });
    const style: React.CSSProperties = {
      ...(transform ? { transform: CSS.Transform.toString(transform) } : {}),
      ...(transition ? { transition } : {}),
    };
    const overdue = t.dueAt ? new Date(t.dueAt) < new Date() : false;
    const done = t.status === "DONE";
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
          <input
            type="checkbox"
            className="mt-1"
            checked={done}
            onChange={() =>
              setStatus.mutate({ id: t.id, status: done ? "TODO" : "DONE" })
            }
            aria-label={done ? "Mark as todo" : "Mark as done"}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex flex-col gap-1 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`font-medium ${done ? "line-through opacity-60" : ""}`}>
                {t.title}
              </span>
              {((t as any).subject) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
                  <Tag className="h-3 w-3" /> {(t as any).subject}
                </span>
              )}
              {t.dueAt && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
                  overdue
                    ? "bg-red-100 text-red-700 ring-red-200 dark:bg-red-900/30 dark:text-red-200 dark:ring-red-800"
                    : "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800"
                }`}>
                  <Calendar className="h-3 w-3" />
                  {new Date(t.dueAt as any).toLocaleString()}
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
        <TaskFilterTabs value={filter} onChange={setFilter} />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {completedTasks}/{totalTasks} completed
        </p>
      </div>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleIds}>
          <ul className="space-y-2">
            {filteredOrderedTasks.map((t) => (
              <TaskItem key={t.id} t={t} />
            ))}
            {tasks.isLoading && <TaskListSkeleton />}
            {!tasks.isLoading && filteredOrderedTasks.length === 0 && (
              <li className="opacity-60">No tasks.</li>
            )}
          </ul>
        </SortableContext>
      </DndContext>

      {tasks.error && (
        <p role="alert" className="text-red-500">
          {tasks.error.message}
        </p>
      )}
      {setDue.error && (
        <p role="alert" className="text-red-500">{setDue.error.message}</p>
      )}

      <TaskModal
        open={!!editingTask}
        mode="edit"
        onClose={() => setEditingTask(null)}
        task={editingTask as any}
      />
    </div>
  );
}

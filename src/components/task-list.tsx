"use client";

import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import { api } from "@/server/api/react";
import { formatLocalDateTime, parseLocalDateTime } from "@/lib/datetime";
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

export function TaskList() {
  const [filter, setFilter] = useState<"all" | "overdue" | "today">("all");
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

  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    if (tasks.data) {
      setItems(tasks.data.map((t) => t.id));
    }
  }, [tasks.data]);

  const setDue = api.task.setDueDate.useMutation({
    onSuccess: async () => utils.task.list.invalidate(),
    onError: (e) => toast.error(e.message || "Failed to set due date"),
  });

  const rename = api.task.updateTitle.useMutation({
    onSuccess: async () => utils.task.list.invalidate(),
    onError: (e) => toast.error(e.message || "Failed to update title"),
  });

  const del = api.task.delete.useMutation({
    onSuccess: async () => utils.task.list.invalidate(),
    onError: (e) => toast.error(e.message || "Failed to delete task"),
  });

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

  const taskData = tasks.data;
  const orderedTasks = React.useMemo(() => {
    if (!taskData) return [] as typeof taskData;
    const map = new Map(taskData.map((t) => [t.id, t]));
    return items.map((id) => map.get(id)).filter(Boolean) as typeof taskData;
  }, [taskData, items]);

  const TaskItem = ({ t }: { t: (typeof orderedTasks)[number] }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: t.id });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };
    const overdue = t.dueAt ? new Date(t.dueAt) < new Date() : false;
    const done = t.status === "DONE";
    return (
      <motion.li
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        key={t.id}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.15 }}
        layout
        className={`flex items-center justify-between rounded border px-3 py-2 ${
          overdue
            ? "border-red-500 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"
            : ""
        }`}
      >
        <div className="flex items-start gap-2 flex-1">
          <input
            type="checkbox"
            className="mt-1"
            checked={done}
            onChange={() =>
              setStatus.mutate({ id: t.id, status: done ? "TODO" : "DONE" })
            }
            aria-label={done ? "Mark as todo" : "Mark as done"}
          />
          <div className="flex flex-col gap-1 flex-1">
            <input
              type="text"
              defaultValue={t.title}
              className={`font-medium rounded border px-2 py-1 ${
                done ? "line-through opacity-60" : ""
              }`}
              onBlur={(e) => rename.mutate({ id: t.id, title: e.currentTarget.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
            <div className="flex items-center gap-2 text-xs opacity-80">
              <label>Due:</label>
              <input
                type="datetime-local"
                className="rounded border px-2 py-1"
                value={t.dueAt ? formatLocalDateTime(new Date(t.dueAt)) : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  const date = v ? parseLocalDateTime(v) : null;
                  setDue.mutate({ id: t.id, dueAt: date });
                }}
              />
              {t.dueAt && (
                <Button
                  variant="secondary"
                  className="underline bg-transparent border-0 px-0 py-0"
                  onClick={() => setDue.mutate({ id: t.id, dueAt: null })}
                >
                  Clear
                </Button>
              )}
              {t.dueAt && (
                <span className="ml-2">
                  {overdue ? "Overdue" : `Due ${new Date(t.dueAt).toLocaleString()}`}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="danger"
          className="text-sm underline bg-transparent px-0 py-0 text-red-600"
          onClick={() => {
            if (confirm("Are you sure you want to delete this task?")) {
              del.mutate({ id: t.id });
            }
          }}
        >
          Delete
        </Button>
      </motion.li>
    );
  };

  return (
    <div className="space-y-3">
      <TaskFilterTabs value={filter} onChange={setFilter} />
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items}>
          <ul className="space-y-2">
            <AnimatePresence>
              {orderedTasks.map((t) => (
                <TaskItem key={t.id} t={t} />
              ))}
            </AnimatePresence>

            {tasks.isLoading && <TaskListSkeleton />}
            {!tasks.isLoading && orderedTasks.length === 0 && (
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
        <p role="alert" className="text-red-500">
          {setDue.error.message}
        </p>
      )}
    </div>
  );
}

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { Calendar, Tag, Clock, GripVertical, MoreVertical } from "lucide-react";
import type Fuse from "fuse.js";

import { StatusDropdown, type TaskStatus } from "@/components/status-dropdown";
import type { Task } from "./use-task-list-query";

function highlightMatches(text: string, indices: readonly [number, number][]) {
  let last = 0;
  const res: React.ReactNode[] = [];
  indices.forEach(([start, end], i) => {
    if (start > last) res.push(text.slice(last, start));
    res.push(<mark key={i}>{text.slice(start, end + 1)}</mark>);
    last = end + 1;
  });
  if (last < text.length) res.push(text.slice(last));
  return res;
}

export const TaskCard = React.forwardRef<
  HTMLLIElement,
  {
    t: Task;
    style?: React.CSSProperties;
    listeners?: any;
    attributes?: any;
    isDragging?: boolean;
    onClick?: () => void;
    depth?: number;
    match?: readonly Fuse.FuseResultMatch[];
    onStatusChange: (next: TaskStatus) => void;
  }
>(({ t, style, listeners, attributes, isDragging, onClick, depth = 0, match, onStatusChange }, ref) => {
  const overdue = t.dueAt ? new Date(t.dueAt) < new Date() : false;
  const done = t.status === "DONE";
  const dueDate = t.dueAt ? new Date(t.dueAt) : null;
  let dueClass = "text-neutral-500";
  if (dueDate) {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    if (dueDate < start) dueClass = "text-red-600";
    else if (dueDate <= end) dueClass = "text-amber-600";
  }
  const matchTitle = match?.find((m) => m.key === "title");
  const titleNode =
    matchTitle && matchTitle.indices
      ? highlightMatches(t.title, matchTitle.indices as any)
      : t.title;

  return (
    <motion.li
      ref={ref}
      style={{ ...style, marginLeft: depth * 16 }}
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      whileHover={{ scale: 1.02, transition: { duration: 0.15, ease: "easeInOut" } }}
      whileTap={{ scale: 0.98, transition: { duration: 0.15, ease: "easeInOut" } }}
      className={`group flex items-center justify-between rounded-md border bg-white p-3 transition-colors hover:bg-neutral-50 ${
        overdue
          ? "border-red-500 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"
          : ""
      } ${isDragging ? "shadow-sm ring-1 ring-neutral-200 translate-y-[-1px]" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3 flex-1">
        <button
          type="button"
          aria-label="Drag to reorder"
          className="cursor-grab text-neutral-400 hover:text-neutral-700 active:cursor-grabbing"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex flex-col flex-1">
          <span className={`font-medium ${done ? "line-through opacity-60" : ""}`}>{titleNode}</span>
          {t.course?.title && (
            <span className="text-sm text-neutral-500">{t.course.title}</span>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-neutral-500">
            {t.dueAt && (
              <span data-testid="due-date" className={`flex items-center gap-1 ${dueClass}`}>
                <Calendar className="h-4 w-4 text-neutral-400" />
                {dueDate!.toLocaleDateString()}
              </span>
            )}
            {t.subject && (
              <span className="flex items-center gap-1">
                <Tag className="h-4 w-4 text-neutral-400" />
                {t.subject}
              </span>
            )}
            {t.effortMinutes && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-neutral-400" />
                {t.effortMinutes}m
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusDropdown
          value={t.status as TaskStatus}
          onChange={onStatusChange}
        />
        <button
          type="button"
          aria-label="More actions"
          className="p-1 text-neutral-400 hover:text-neutral-700"
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
    </motion.li>
  );
});
TaskCard.displayName = "TaskCard";

export const TaskListItem = React.forwardRef<
  HTMLLIElement,
  {
    t: Task;
    depth: number;
    virtualStyle?: React.CSSProperties;
    match?: readonly Fuse.FuseResultMatch[];
    onClick: () => void;
    onStatusChange: (next: TaskStatus) => void;
  }
>(({ t, depth, virtualStyle, match, onClick, onStatusChange }, ref) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: t.id });
  const style: React.CSSProperties = {
    ...virtualStyle,
    ...(transform ? { transform: CSS.Transform.toString(transform) } : {}),
    ...(transition ? { transition } : {}),
  };
  if (isDragging) {
    style.transform = `${style.transform ?? ""} translateY(-1px)`;
  }
  return (
    <TaskCard
      ref={(el) => {
        setNodeRef(el);
        if (typeof ref === "function") ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLLIElement | null>).current = el;
      }}
      t={t}
      style={style}
      listeners={listeners}
      attributes={attributes}
      isDragging={isDragging}
      onClick={onClick}
      depth={depth}
      match={match}
      onStatusChange={onStatusChange}
    />
  );
});
TaskListItem.displayName = "TaskListItem";

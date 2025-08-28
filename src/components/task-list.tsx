"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import Fuse from "fuse.js";
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
import { Calendar, Tag, Clock, GripVertical, MoreVertical } from "lucide-react";

import { api } from "@/server/api/react";
import type { RouterOutputs } from "@/server/api/root";

import { TaskListSkeleton } from "./task-list-skeleton";
import { TaskModal } from "@/components/task-modal";
import { StatusDropdown, type TaskStatus } from "@/components/status-dropdown";
import { Button } from "@/components/ui/button";

type Task = RouterOutputs["task"]["list"][number];
type Priority = "LOW" | "MEDIUM" | "HIGH";

interface TaskListProps {
  filter: "all" | "overdue" | "today" | "archive";
  subject: string | null;
  priority: Priority | null;
  courseId: string | null;
  projectId: string | null;
  query: string;
  onCountChange?: (count: number) => void;
}

export function TaskList({
  filter,
  subject,
  priority,
  courseId,
  projectId,
  query,
  onCountChange,
}: TaskListProps) {
  const utils = api.useUtils();
  const user = api.user.get.useQuery();
  const { data: session } = useSession();

  const queryInput = React.useMemo(() => {
    const base: any = {
      filter,
      subject: subject ?? undefined,
      priority: priority ?? undefined,
      courseId: courseId ?? undefined,
      projectId: projectId ?? undefined,
    };
    if (!user.data?.timezone) {
      const tzOffsetMinutes = new Date().getTimezoneOffset();
      const now = new Date();
      const startLocal = new Date(now);
      startLocal.setHours(0, 0, 0, 0);
      const endLocal = new Date(now);
      endLocal.setHours(23, 59, 59, 999);
      base.tzOffsetMinutes = tzOffsetMinutes;
      base.todayStart = startLocal;
      base.todayEnd = endLocal;
    }
    return base;
  }, [filter, subject, priority, courseId, projectId, user.data?.timezone]);

  const PAGE_SIZE = 20;
  const tasks = api.task.list.useInfiniteQuery(
    { ...queryInput, limit: PAGE_SIZE },
    {
      getNextPageParam: (lastPage) =>
        lastPage.length === PAGE_SIZE
          ? lastPage[lastPage.length - 1]?.id
          : undefined,
      enabled: !!session,
    }
  );
  const flatTasks = React.useMemo(
    () => tasks.data?.pages.flat() ?? [],
    [tasks.data]
  );
  // Keep a stable snapshot of the fetched tasks for the current filter
  const [taskDataSnapshot, setTaskDataSnapshot] = useState<Task[]>();
  const prevFilterRef = React.useRef(filter);
  useEffect(() => {
    if (flatTasks.length === 0) return;
    // On first data load or when filter changes, capture snapshot
    if (taskDataSnapshot === undefined || prevFilterRef.current !== filter) {
      setTaskDataSnapshot(flatTasks);
      prevFilterRef.current = filter;
      return;
    }
    // If the set of task IDs has changed, refresh snapshot (create/delete)
    const snapIds = new Set(taskDataSnapshot.map((t) => t.id));
    const dataIds = new Set(flatTasks.map((t) => t.id));
    const idsDiffer =
      snapIds.size !== dataIds.size ||
      [...dataIds].some((id) => !snapIds.has(id));
    if (idsDiffer) {
      setTaskDataSnapshot(flatTasks);
      return;
    }
    // If content changed for existing IDs, refresh snapshot when updatedAt differs
    const snapById = new Map(taskDataSnapshot.map((t) => [t.id, t]));
    const contentChanged = flatTasks.some((t) => {
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
      setTaskDataSnapshot(flatTasks);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, flatTasks, taskDataSnapshot]);
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    setItems(flatTasks.map((t) => t.id));
  }, [flatTasks]);



  const setDue = api.task.setDueDate.useMutation({
    onSuccess: async () => utils.task.list.invalidate(),
  });

  // Inline rename/delete removed in minimalist UI; handled in modal

  const setStatus = api.task.setStatus.useMutation({
    onSuccess: async () => utils.task.list.invalidate(),
  });

  const reorder = api.task.reorder.useMutation();

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      const newItems = arrayMove(prev, oldIndex, newIndex);
      const snapshot = [...prev];
      reorder.mutate(
        { ids: newItems },
        {
          onSuccess: async () => utils.task.list.invalidate(),
          onError: () => setItems(snapshot),
        }
      );
      return newItems;
    });
  };

  const taskData = taskDataSnapshot ?? flatTasks;
  const orderedTasks = React.useMemo(() => {
    const list = taskData ?? [];
    if (items.length === 0) return list;
    const map = new Map((list as Task[]).map((t: Task) => [t.id, t]));
    return items.map((id) => map.get(id)).filter(Boolean) as Task[];
  }, [taskData, items]);

  type SearchResult = Pick<Fuse.FuseResult<Task>, "item" | "matches">;
  const fuseResults = React.useMemo<SearchResult[]>(() => {
    if (!query) return orderedTasks.map((t) => ({ item: t }));
    const fuse = new Fuse(orderedTasks, {
      keys: ["title"],
      includeMatches: true,
      threshold: 0.4,
      ignoreLocation: true,
    });
    // Normalize results to only include the fields we use
    return fuse.search(query).map((r) => ({ item: r.item, matches: r.matches }));
  }, [orderedTasks, query]);

  // Build map of match data for highlighting (preserves fuzzy search behavior)
  const matchesById = React.useMemo(
    () =>
      new Map<string, readonly Fuse.FuseResultMatch[]>(
        fuseResults.map((r) => [r.item.id, r.matches ?? []])
      ),
    [fuseResults]
  );

  // Apply structured filters (subject/priority/courseId/projectId) on top of search results
  const filteredOrderedTasks = React.useMemo(
    () =>
      fuseResults
        .map((r) => r.item)
        .filter(
          (t) =>
            (!subject || t.subject === subject) &&
            (!priority || t.priority === priority) &&
            (!courseId || t.courseId === courseId) &&
            (!projectId || t.projectId === projectId)
        ),
    [fuseResults, subject, priority, courseId, projectId]
  );

  React.useEffect(() => {
    onCountChange?.(filteredOrderedTasks.length);
  }, [filteredOrderedTasks.length, onCountChange]);

  // Compute the visible ids in the current order; feed to SortableContext
  const visibleIds = React.useMemo(
    () => filteredOrderedTasks.map((t) => t.id),
    [filteredOrderedTasks]
  );

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredOrderedTasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
  });
  const useVirtual = filteredOrderedTasks.length >= 20;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  // Infinite scroll handler for virtualized list
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const handleScroll = () => {
      if (!tasks.hasNextPage || tasks.isFetchingNextPage) return;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
        void tasks.fetchNextPage();
      }
    };
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, [tasks]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      const container = parentRef.current;
      if (!container || !target || !container.contains(target)) return;
      const focusable = target.closest(
        "input, textarea, select, button, a, [contenteditable], [tabindex]:not([tabindex='-1'])"
      );
      if (focusable) return;
      const overlay = document.querySelector(
        "[role='dialog'], [role='menu'], [role='listbox']:not([data-task-list])"
      );
      if (overlay) return;
      if (e.key === "ArrowDown" || e.key.toLowerCase() === "j") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredOrderedTasks.length - 1));
      } else if (e.key === "ArrowUp" || e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filteredOrderedTasks.length]);

  useEffect(() => {
    if (selectedIndex < 0 || selectedIndex >= filteredOrderedTasks.length) return;
    if (useVirtual) {
      rowVirtualizer.scrollToIndex(selectedIndex);
    } else {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, useVirtual, rowVirtualizer, filteredOrderedTasks.length]);

  // Surface API errors to be caught by ErrorBoundary
  if (tasks.error) throw tasks.error;
  if (setDue.error) throw setDue.error;
  if (setStatus.error) throw setStatus.error;
  if (reorder.error) throw reorder.error;

  const highlightMatches = (
    text: string,
    indices: readonly [number, number][]
  ) => {
    let last = 0;
    const res: React.ReactNode[] = [];
    indices.forEach(([start, end], i) => {
      if (start > last) res.push(text.slice(last, start));
      res.push(<mark key={i}>{text.slice(start, end + 1)}</mark>);
      last = end + 1;
    });
    if (last < text.length) res.push(text.slice(last));
    return res;
  };

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-neutral-500">
      <span className="text-4xl">📝</span>
      <Button onClick={() => setShowCreateModal(true)}>
        Create your first task
      </Button>
      <p className="text-xs text-neutral-400">
        Tip: press <kbd className="rounded border px-1">N</kbd> to add a task
      </p>
    </div>
  );

  const TaskItem = ({
    t,
    index,
    virtualStyle,
  }: {
    t: Task;
    index: number;
    virtualStyle?: React.CSSProperties;
  }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: t.id });
    const style: React.CSSProperties = {
      ...virtualStyle,
      ...(transform ? { transform: CSS.Transform.toString(transform) } : {}),
      ...(transition ? { transition } : {}),
    };
    if (isDragging) {
      style.transform = `${style.transform ?? ""} translateY(-1px)`;
    }
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
    const match = matchesById.get(t.id)?.find((m) => m.key === "title");
    const titleNode = match && match.indices
      ? highlightMatches(t.title, match.indices as any)
      : t.title;

    return (
      <li
        role="option"
        ref={(node) => {
          setNodeRef(node);
          itemRefs.current[index] = node;
        }}
        style={style}
        key={t.id}
        aria-selected={selectedIndex === index}
        className={`group flex items-center justify-between rounded-md border bg-white p-3 transition-colors hover:bg-neutral-50 ${
          selectedIndex === index
            ? 'ring-2 ring-indigo-500'
            : isDragging
              ? 'shadow-sm ring-1 ring-neutral-200 translate-y-[-1px]'
              : ''
        }`}
        onClick={() => setEditingTask(t)}
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
            <span className={`font-medium ${done ? 'line-through opacity-60' : ''}`}>{titleNode}</span>
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
            onChange={(next) => setStatus.mutate({ id: t.id, status: next })}
          />
          <button
            type="button"
            aria-label="More actions"
            className="p-1 text-neutral-400 hover:text-neutral-700"
            onClick={(e) => {
              e.stopPropagation();
              setEditingTask(t);
            }}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </li>
    );
  };

  return (
    <div className="w-full space-y-3 md:w-auto">
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleIds}>
          {useVirtual ? (
            <div
              ref={parentRef}
              className="overflow-auto max-h-[50vh] md:max-h-[600px]"
              data-testid="task-scroll"
              role="listbox"
              data-task-list
            >
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
                      index={virtualRow.index}
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
            <ul className="space-y-2" role="listbox">
              {filteredOrderedTasks.map((t, i) => (
                <TaskItem key={t.id} t={t} index={i} />
              ))}
              {(tasks.isLoading || tasks.isFetchingNextPage) && <TaskListSkeleton />}
              {!tasks.isLoading &&
                !tasks.isFetchingNextPage &&
                filteredOrderedTasks.length === 0 && (
                  <li>
                    <EmptyState />
                  </li>
                )}
            </ul>
          )}
        </SortableContext>
        {useVirtual &&
          !tasks.isLoading &&
          !tasks.isFetchingNextPage &&
          filteredOrderedTasks.length === 0 && <EmptyState />}
        {useVirtual &&
          (tasks.isLoading || tasks.isFetchingNextPage) && <TaskListSkeleton />}
      </DndContext>

      <TaskModal
        open={!!editingTask}
        mode="edit"
        onClose={() => setEditingTask(null)}
        task={editingTask ?? undefined}
      />
      <TaskModal
        open={showCreateModal}
        mode="create"
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
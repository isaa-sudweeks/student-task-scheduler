"use client";

import React, { useState, useEffect } from "react";
import Fuse from "fuse.js";
import {
  DndContext,
  closestCenter,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove } from "@dnd-kit/sortable";
import { AnimatePresence } from "framer-motion";

import { api } from "@/server/api/react";
import { TaskModal } from "@/components/task-modal";
import { Button } from "@/components/ui/button";
import type { TaskStatus } from "@/components/status-dropdown";
import { TaskListSkeleton } from "../task-list-skeleton";
import {
  useTaskListQuery,
  type Task,
  type Priority,
} from "./use-task-list-query";
import { TaskListItem, TaskCard } from "./task-list-item";
import { useTaskListVirtualization } from "./use-task-list-virtualization";
import { useTaskListKeyboard } from "./use-task-list-keyboard";

interface TaskListProps {
  filter: "all" | "overdue" | "today" | "archive";
  subject: string | null;
  status: TaskStatus | null;
  priority: Priority | null;
  courseId: string | null;
  projectId: string | null;
  query: string;
  onCountChange?: (count: number) => void;
}

export function TaskList({
  filter,
  subject,
  status,
  priority,
  courseId,
  projectId,
  query,
  onCountChange,
}: TaskListProps) {
  const utils = api.useUtils();
  const { tasks, flatTasks, taskData } = useTaskListQuery({
    filter,
    subject,
    status,
    priority,
    courseId,
    projectId,
  });

  const [items, setItems] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setItems(flatTasks.map((t) => t.id));
  }, [flatTasks]);

  const setStatus = api.task.setStatus.useMutation({
    onSuccess: async () => utils.task.list.invalidate(),
  });

  const reorder = api.task.reorder.useMutation();

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
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
      includeScore: true,
      threshold: 0.35,
      ignoreLocation: true,
    });
    const aggregated = new Map<
      string,
      { item: Task; matches: Fuse.FuseResultMatch[]; score: number }
    >();
    for (const result of fuse.search(query)) {
      aggregated.set(result.item.id, {
        item: result.item,
        matches: result.matches ? [...result.matches] : [],
        score: result.score ?? 0,
      });
    }
    const queryLower = query.toLowerCase();
    const findIndices = (value: string) => {
      const indices: [number, number][] = [];
      const lower = value.toLowerCase();
      let start = 0;
      while (start <= lower.length) {
        const idx = lower.indexOf(queryLower, start);
        if (idx === -1) break;
        indices.push([idx, idx + queryLower.length - 1]);
        start = idx + queryLower.length;
      }
      return indices;
    };
    const upsertMatch = (
      task: Task,
      key: "subject" | "notes",
      value: string,
      score: number
    ) => {
      const indices = findIndices(value);
      if (indices.length === 0) return;
      const existing = aggregated.get(task.id);
      const matches = [
        ...(existing?.matches ?? []),
        {
          key,
          value,
          indices,
        } as Fuse.FuseResultMatch,
      ];
      const nextScore = existing ? Math.min(existing.score, score) : score;
      aggregated.set(task.id, { item: task, matches, score: nextScore });
    };
    for (const task of orderedTasks) {
      if (task.subject) {
        upsertMatch(task, "subject", task.subject, 0.4);
      }
      if (task.notes) {
        upsertMatch(task, "notes", task.notes, 0.6);
      }
    }
    return [...aggregated.values()]
      .sort((a, b) => a.score - b.score)
      .map(({ item, matches }) => ({ item, matches }));
  }, [orderedTasks, query]);

  const matchesById = React.useMemo(
    () =>
      new Map<string, readonly Fuse.FuseResultMatch[]>(
        fuseResults.map((r) => [r.item.id, r.matches ?? []])
      ),
    [fuseResults]
  );

  const flatFilteredTasks = React.useMemo(
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

  const { ordered: filteredOrderedTasks, depthById } = React.useMemo(() => {
    const tasksByParent = new Map<string | null, Task[]>();
    for (const t of flatFilteredTasks) {
      const key = t.parentId ?? null;
      const list = tasksByParent.get(key) ?? [];
      list.push(t);
      tasksByParent.set(key, list);
    }
    const topLevel = flatFilteredTasks.filter(
      (t) => !t.parentId || !flatFilteredTasks.some((p) => p.id === t.parentId)
    );
    const ordered: Task[] = [];
    const depthById = new Map<string, number>();
    const traverse = (tasks: Task[], depth: number) => {
      for (const task of tasks) {
        ordered.push(task);
        depthById.set(task.id, depth);
        const children = tasksByParent.get(task.id) ?? [];
        traverse(children, depth + 1);
      }
    };
    traverse(topLevel, 0);
    return { ordered, depthById };
  }, [flatFilteredTasks]);

  useEffect(() => {
    onCountChange?.(filteredOrderedTasks.length);
  }, [filteredOrderedTasks.length, onCountChange]);

  const { parentRef, rowVirtualizer, useVirtual } = useTaskListVirtualization(
    filteredOrderedTasks.length,
    tasks as any
  );
  const { itemRefs } = useTaskListKeyboard(
    filteredOrderedTasks.length,
    useVirtual,
    rowVirtualizer,
    parentRef
  );

  const visibleIds = React.useMemo(
    () => filteredOrderedTasks.map((t) => t.id),
    [filteredOrderedTasks]
  );

  const activeTask = React.useMemo(
    () => filteredOrderedTasks.find((t) => t.id === activeId) ?? null,
    [activeId, filteredOrderedTasks]
  );

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  if (tasks.error) throw tasks.error;
  if (setStatus.error) throw setStatus.error;
  if (reorder.error) throw reorder.error;

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

  return (
    <div className="w-full space-y-3 md:w-auto">
      <DndContext
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
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
                  height: rowVirtualizer.getTotalSize(),
                  position: "relative",
                }}
              >
                <AnimatePresence initial={false}>
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const t = filteredOrderedTasks[virtualRow.index];
                    return (
                      <TaskListItem
                        key={t.id}
                        t={t}
                        depth={depthById.get(t.id) ?? 0}
                        match={matchesById.get(t.id)}
                        onClick={() => setEditingTask(t)}
                        onStatusChange={(next) =>
                          setStatus.mutate({ id: t.id, status: next })
                        }
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
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {filteredOrderedTasks.map((t, idx) => (
                  <TaskListItem
                    key={t.id}
                    ref={(el) => { itemRefs.current[idx] = el; }}
                    t={t}
                    depth={depthById.get(t.id) ?? 0}
                    match={matchesById.get(t.id)}
                    onClick={() => setEditingTask(t)}
                    onStatusChange={(next) =>
                      setStatus.mutate({ id: t.id, status: next })
                    }
                  />
                ))}
              </AnimatePresence>

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
        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <TaskCard
              t={activeTask}
              isDragging
              depth={depthById.get(activeTask.id) ?? 0}
              match={matchesById.get(activeTask.id)}
              onClick={() => setEditingTask(activeTask)}
              onStatusChange={(next) =>
                setStatus.mutate({ id: activeTask.id, status: next })
              }
            />
          ) : null}
        </DragOverlay>
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


"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import { api } from "@/server/api/react";
import { formatLocalDateTime, parseLocalDateTime } from "@/lib/datetime";
import { TaskListSkeleton } from "./task-list-skeleton";
import { TaskFilterTabs } from "./task-filter-tabs";

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

  const filteredTasks = React.useMemo(
    () =>
      tasks.data?.filter((t) =>
        t.title.toLowerCase().includes(query.toLowerCase())
      ) ?? [],
    [tasks.data, query]
  );

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

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        placeholder="Search tasks..."
        className="w-full bg-transparent border-0 px-0 py-1 outline-none placeholder:text-muted-foreground"
      />
      <TaskFilterTabs value={filter} onChange={setFilter} />
      <ul className="space-y-2">
        <AnimatePresence>
          {filteredTasks.map((t) => {
            const overdue = t.dueAt ? new Date(t.dueAt) < new Date() : false;
            const done = t.status === "DONE";
            return (
              <motion.li
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
                    <div className="flex items-center gap-2">
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
                      {t.subject && (
                        <span className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                          {t.subject}
                        </span>
                      )}
                    </div>
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
          })}
        </AnimatePresence>

        {tasks.isLoading && <TaskListSkeleton />}
        {!tasks.isLoading && filteredTasks.length === 0 && (
          <li className="opacity-60">No tasks.</li>
        )}
      </ul>

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

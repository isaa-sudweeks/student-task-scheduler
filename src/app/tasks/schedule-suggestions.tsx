"use client";

import React from "react";
import Link from "next/link";
import { api } from "@/server/api/react";
import type { RouterOutputs } from "@/server/api/root";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

type Suggestion = RouterOutputs["task"]["scheduleSuggestions"]["suggestions"][number];

const formatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function createAcceptSuggestionHandler({
  eventSchedule,
  settings,
  setSuggestions,
  setAcceptedIds,
  toast,
}: {
  eventSchedule: Pick<ReturnType<typeof api.event.schedule.useMutation>, "mutateAsync">;
  settings: RouterOutputs["user"]["getSettings"] | undefined;
  setSuggestions: React.Dispatch<React.SetStateAction<Suggestion[]>>;
  setAcceptedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  toast: typeof toast;
}) {
  return async (suggestion: Suggestion) => {
    const durationMinutes = Math.max(
      1,
      Math.round((suggestion.endAt.getTime() - suggestion.startAt.getTime()) / 60000),
    );
    try {
      const result = await eventSchedule.mutateAsync({
        taskId: suggestion.taskId,
        startAt: suggestion.startAt,
        durationMinutes,
        dayWindowStartHour: settings?.dayWindowStartHour ?? 8,
        dayWindowEndHour: settings?.dayWindowEndHour ?? 18,
      });
      setSuggestions((prev) => prev.filter((s) => s.taskId !== suggestion.taskId));
      setAcceptedIds((prev) => {
        const next = new Set(prev);
        next.add(suggestion.taskId);
        return next;
      });
      toast.success("Scheduled task");
      if (result.syncWarnings?.length) {
        toast.info(result.syncWarnings[0] ?? "Event saved locally, but calendar sync reported warnings.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to schedule task");
    }
  };
}

export default function ScheduleSuggestionsPage() {
  const utils = api.useUtils();
  const tasksQuery = api.task.list.useQuery();
  const settingsQuery = api.user.getSettings.useQuery();
  const suggestionsMutation = api.task.scheduleSuggestions.useMutation();
  const eventSchedule = api.event.schedule.useMutation({
    onSuccess: async () => {
      try {
        await Promise.all([
          utils.event.listRange.invalidate(),
          utils.task.list.invalidate(),
        ]);
      } catch (error) {
        console.error(error);
      }
    },
  });

  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [acceptedIds, setAcceptedIds] = React.useState<Set<string>>(new Set());
  const [selectedTaskIds, setSelectedTaskIds] = React.useState<Set<string>>(new Set());
  const [selectionError, setSelectionError] = React.useState<string | null>(null);

  const hasInitializedSelection = React.useRef(false);

  const tasksById = React.useMemo(() => {
    const map = new Map<string, RouterOutputs["task"]["list"][number]>();
    for (const task of tasksQuery.data ?? []) {
      map.set(task.id, task);
    }
    return map;
  }, [tasksQuery.data]);

  const toggleTaskSelection = React.useCallback((taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      setSelectionError(
        next.size === 0 ? "Select at least one task to generate suggestions." : null,
      );
      return next;
    });
  }, []);

  React.useEffect(() => {
    const tasks = tasksQuery.data ?? [];
    setSelectedTaskIds((prev) => {
      const next = new Set<string>();
      const available = new Set(tasks.map((task) => task.id));
      for (const id of prev) {
        if (available.has(id)) {
          next.add(id);
        }
      }
      if (!hasInitializedSelection.current) {
        if (available.size === 0) {
          return next;
        }
        hasInitializedSelection.current = true;
        return new Set(available);
      }
      if (available.size === 0) {
        hasInitializedSelection.current = false;
        return next;
      }
      return next;
    });
  }, [tasksQuery.data]);

  const generate = React.useCallback(async () => {
    if (selectedTaskIds.size === 0) {
      setSelectionError("Select at least one task to generate suggestions.");
      return;
    }
    try {
      const result = await suggestionsMutation.mutateAsync({
        taskIds: Array.from(selectedTaskIds),
      });
      setSuggestions(result.suggestions);
    } catch (error) {
      console.error(error);
    }
  }, [selectedTaskIds, suggestionsMutation]);

  const acceptSuggestion = React.useMemo(
    () =>
      createAcceptSuggestionHandler({
        eventSchedule,
        settings: settingsQuery.data,
        setSuggestions,
        setAcceptedIds,
        toast,
      }),
    [eventSchedule, settingsQuery.data],
  );

  const selectableTasks = tasksQuery.data ?? [];
  const hasTasks = selectableTasks.length > 0;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Schedule suggestions</h1>
          <p className="text-sm text-muted-foreground">
            Generate AI-assisted time slots for unscheduled tasks and accept them with a single click.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/calendar"
            className="rounded border px-3 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10"
          >
            Calendar
          </Link>
          <Link
            href="/"
            className="rounded border px-3 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10"
          >
            Tasks
          </Link>
        </div>
      </header>

      <section className="rounded-xl border bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/60">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Select tasks</h2>
                <span className="text-xs text-muted-foreground">
                  {selectedTaskIds.size} selected
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Only checked tasks will be included when generating new suggestions.
              </p>
              <div className="max-h-60 overflow-y-auto rounded border border-dashed border-black/10 dark:border-white/10">
                {tasksQuery.isLoading ? (
                  <p className="p-3 text-sm text-muted-foreground">Loading tasks…</p>
                ) : hasTasks ? (
                  <ul className="divide-y divide-black/5 text-sm dark:divide-white/10">
                    {selectableTasks.map((task) => {
                      const inputId = `task-select-${task.id}`;
                      return (
                        <li key={task.id} className="flex items-start gap-2 px-3 py-2">
                          <input
                            id={inputId}
                            type="checkbox"
                            checked={selectedTaskIds.has(task.id)}
                            onChange={() => toggleTaskSelection(task.id)}
                            className="mt-1 h-4 w-4 rounded border border-black/30 text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-white/20 dark:bg-slate-900"
                          />
                          <label htmlFor={inputId} className="flex flex-1 flex-col gap-1">
                            <span className="font-medium">{task.title}</span>
                            {task.dueAt && (
                              <span className="text-xs text-muted-foreground">
                                Due {formatter.format(new Date(task.dueAt))}
                              </span>
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="p-3 text-sm text-muted-foreground">
                    No tasks available for scheduling.
                  </p>
                )}
              </div>
              {selectionError && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {selectionError}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3 sm:items-end">
              <Button
                onClick={generate}
                disabled={
                  suggestionsMutation.isPending || selectedTaskIds.size === 0 || !hasTasks
                }
              >
                {suggestionsMutation.isPending ? "Generating…" : "Generate suggestions"}
              </Button>
              {suggestionsMutation.error && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {suggestionsMutation.error.message}
                </p>
              )}
              <p className="max-w-xs text-xs text-muted-foreground text-right">
                Suggestions respect your working hours ({settingsQuery.data?.dayWindowStartHour ?? 8}:00 –{' '}
                {settingsQuery.data?.dayWindowEndHour ?? 18}:00).
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            {suggestions.length > 0 ? (
              <table className="min-w-full divide-y divide-black/5 text-sm dark:divide-white/10">
              <thead>
                <tr className="text-left">
                  <th className="px-3 py-2">Task</th>
                  <th className="px-3 py-2">Start</th>
                  <th className="px-3 py-2">End</th>
                  <th className="px-3 py-2">Origin</th>
                  <th className="px-3 py-2" aria-label="actions" />
                </tr>
              </thead>
              <tbody>
                {suggestions.map((suggestion) => {
                  const task = tasksById.get(suggestion.taskId);
                  return (
                    <tr key={suggestion.taskId} className="odd:bg-black/5/50 dark:odd:bg-white/5">
                      <td className="px-3 py-2 font-medium">
                        <div>{task?.title ?? suggestion.taskId}</div>
                        {task?.dueAt && (
                          <div className="text-xs text-muted-foreground">
                            Due {formatter.format(new Date(task.dueAt))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">{formatter.format(suggestion.startAt)}</td>
                      <td className="px-3 py-2">{formatter.format(suggestion.endAt)}</td>
                      <td className="px-3 py-2 capitalize">{suggestion.origin}</td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="secondary"
                          className="px-3 py-1 text-sm"
                          disabled={eventSchedule.isPending}
                          onClick={() => void acceptSuggestion(suggestion)}
                        >
                          Accept
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="rounded border border-dashed border-black/10 bg-black/5 p-4 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/5">
              Run the generator to view proposed time slots for your remaining tasks.
            </p>
          )}
          </div>
        </div>
      </section>

      {acceptedIds.size > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-900/30 dark:text-green-200">
          Scheduled {acceptedIds.size} task{acceptedIds.size === 1 ? '' : 's'} this session.
        </div>
      )}
    </main>
  );
}


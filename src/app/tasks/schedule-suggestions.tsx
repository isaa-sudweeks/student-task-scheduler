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
      if (result.googleSyncWarning) {
        toast.info("Event saved locally, but Google Calendar sync failed.");
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

  const tasksById = React.useMemo(() => {
    const map = new Map<string, RouterOutputs["task"]["list"][number]>();
    for (const task of tasksQuery.data ?? []) {
      map.set(task.id, task);
    }
    return map;
  }, [tasksQuery.data]);

  const generate = React.useCallback(async () => {
    try {
      const result = await suggestionsMutation.mutateAsync();
      setSuggestions(result.suggestions);
    } catch (error) {
      console.error(error);
    }
  }, [suggestionsMutation]);

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button onClick={generate} disabled={suggestionsMutation.isPending}>
              {suggestionsMutation.isPending ? "Generating…" : "Generate suggestions"}
            </Button>
            {suggestionsMutation.error && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {suggestionsMutation.error.message}
              </p>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Suggestions respect your working hours ({settingsQuery.data?.dayWindowStartHour ?? 8}:00 –{' '}
            {settingsQuery.data?.dayWindowEndHour ?? 18}:00).
          </p>
        </div>

        <div className="mt-4 overflow-x-auto">
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
      </section>

      {acceptedIds.size > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-900/30 dark:text-green-200">
          Scheduled {acceptedIds.size} task{acceptedIds.size === 1 ? '' : 's'} this session.
        </div>
      )}
    </main>
  );
}


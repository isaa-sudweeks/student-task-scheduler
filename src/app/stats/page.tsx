"use client";

import React from "react";
import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { api } from "@/server/api/react";
import type { RouterOutputs } from "@/server/api/root";
import { ErrorBoundary } from "@/components/error-boundary";

type Task = RouterOutputs["task"]["list"][number];

export default function StatsPage() {
  const { data: session } = useSession();
  const { data, isLoading, error } = api.task.list.useQuery(undefined, {
    enabled: !!session,
  });
  const tasks: RouterOutputs["task"]["list"] = data ?? [];
  const { data: focusData } = api.focus.aggregate.useQuery();
  const focusMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    const totals = focusData ?? [];
    for (const f of totals) {
      map[f.taskId] = f.durationMs;
    }
    return map;
  }, [focusData]);
  const focusByTask = tasks
    .map((t) => ({
      id: t.id,
      title: t.title,
      minutes: Math.round((focusMap[t.id] ?? 0) / 60000),
    }))
    .filter((f) => f.minutes > 0);
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === "dark";
  const chartColors = React.useMemo(
    () => ({
      text: isDark ? "#ffffff" : "#000000",
      axis: isDark ? "#ffffff" : "#000000",
      bar: {
        TODO: isDark ? "#60a5fa" : "#8884d8",
        IN_PROGRESS: isDark ? "#fbbf24" : "#ffc658",
        DONE: isDark ? "#34d399" : "#82ca9d",
      } as Record<Task["status"], string>,
      focusBar: isDark ? "#34d399" : "#8884d8",
      pie: isDark
        ? ["#34d399", "#60a5fa", "#fbbf24", "#fb923c"]
        : ["#8884d8", "#82ca9d", "#ffc658", "#ff8042"],
    }),
    [isDark]
  );

  if (error) throw error;
  if (isLoading) return <main>Loading...</main>;

  const total = tasks.length;
  const completed = tasks.filter((t: Task) => t.status === "DONE").length;
  const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);

  const statusCounts = tasks.reduce(
    (acc: Record<string, number>, task: Task) => {
      acc[task.status] = (acc[task.status] ?? 0) + 1;
      return acc;
    },
    {}
  );

  const statusData: { status: string; count: number }[] =
    Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count: Number(count),
    }));

  const subjectCounts = tasks.reduce(
    (acc: Record<string, number>, task: Task) => {
      const subject = task.subject ?? "Uncategorized";
      acc[subject] = (acc[subject] ?? 0) + 1;
      return acc;
    },
    {}
  );

  const subjectData: { subject: string; count: number }[] =
    Object.entries(subjectCounts).map(([subject, count]) => ({
      subject,
      count: Number(count),
    }));

  return (
    <ErrorBoundary fallback={<main>Failed to load stats</main>}>
      <main className="space-y-6 text-neutral-900 dark:text-neutral-100">
        <header>
          <h1 className="text-2xl font-semibold">Task Statistics</h1>
        </header>
        <section className="space-y-2">
          <p>Total Tasks: {total}</p>
          <p>Completion Rate: {completionRate}%</p>
        </section>
        <section className="space-y-2">
          <h2 className="text-xl font-medium">By Status</h2>
          <ul>
            {statusData.map((s) => (
              <li key={s.status}>
                {s.status}: {s.count}
              </li>
            ))}
          </ul>
          <BarChart width={400} height={200} data={statusData}>
            <XAxis
              dataKey="status"
              stroke={chartColors.axis}
              tick={{ fill: chartColors.text }}
            />
            <YAxis
              allowDecimals={false}
              stroke={chartColors.axis}
              tick={{ fill: chartColors.text }}
            />
            <Tooltip />
            <Bar dataKey="count">
              {statusData.map((s) => (
                <Cell
                  key={s.status}
                  fill={chartColors.bar[s.status as keyof typeof chartColors.bar]}
                />
              ))}
            </Bar>
          </BarChart>
        </section>
        <section className="space-y-2">
          <h2 className="text-xl font-medium">By Subject</h2>
          <ul>
            {subjectData.map((s) => (
              <li key={s.subject}>
                {s.subject}: {s.count}
              </li>
            ))}
          </ul>
          <PieChart width={400} height={200}>
            <Pie data={subjectData} dataKey="count" nameKey="subject" outerRadius={80}>
              {subjectData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={chartColors.pie[index % chartColors.pie.length]}
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </section>
        <section className="space-y-2">
          <h2 className="text-xl font-medium">Focus Time by Task</h2>
          <ul>
            {focusByTask.map((f) => (
              <li key={f.id}>
                {f.title}: {f.minutes}m
              </li>
            ))}
          </ul>
          <BarChart width={400} height={200} data={focusByTask}>
            <XAxis
              dataKey="title"
              stroke={chartColors.axis}
              tick={{ fill: chartColors.text }}
            />
            <YAxis
              allowDecimals={false}
              stroke={chartColors.axis}
              tick={{ fill: chartColors.text }}
            />
            <Tooltip />
            <Bar dataKey="minutes" fill={chartColors.focusBar} />
          </BarChart>
        </section>
      </main>
    </ErrorBoundary>
  );
}

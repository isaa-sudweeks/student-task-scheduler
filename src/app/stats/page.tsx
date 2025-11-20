"use client";

import React from "react";
import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Label,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { api } from "@/server/api/react";
import type { RouterOutputs } from "@/server/api/root";
import { exportStatsToCSV } from "@/lib/export";
import { ErrorBoundary } from "@/components/error-boundary";
import { StatCard } from "@/components/ui/stat-card";
import { Input } from "@/components/ui/input";
import { TaskFilterTabs, type TaskFilter } from "@/components/task-filter-tabs";
import { Button } from "@/components/ui/button";
import { CheckCircle, List, GraduationCap, Award, TrendingUp } from "lucide-react";
import { percentageToGpa, percentageToLetterGrade } from "@/lib/grades";

type Task = RouterOutputs["task"]["list"][number];
type CourseSummary = RouterOutputs["course"]["list"][number];

export default function StatsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [startDate, setStartDate] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = React.useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const range = React.useMemo(
    () => ({ start: new Date(startDate), end: new Date(endDate) }),
    [startDate, endDate]
  );

  const [filter, setFilter] = React.useState<TaskFilter>("all");
  const [subject, setSubject] = React.useState<string | null>(null);
  const queryInput = React.useMemo(
    () => ({ filter, subject: subject ?? undefined, start: range.start, end: range.end }),
    [filter, subject, range.start, range.end]
  );
  const { data, isLoading, error } = api.task.list.useQuery(queryInput, {
    enabled: !!session,
  });
  const tasks: RouterOutputs["task"]["list"] = data ?? [];
  const { data: coursesData = [] } = api.course.list.useQuery(
    { page: 1, limit: 100 },
    { enabled: !!session }
  );
  const { data: focusData } = api.focus.aggregate.useQuery(range);
  const focusMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    const totals = focusData ?? [];
    for (const f of totals) {
      map[f.taskId] = f.durationMs;
    }
    return map;
  }, [focusData]);

  const timeByTask = tasks
    .map((t) => {
      const plannedMinutes = t.effortMinutes ?? 0;
      const actualMinutes = Math.round((focusMap[t.id] ?? 0) / 60000);
      const deltaMinutes = actualMinutes - plannedMinutes;
      return {
        id: t.id,
        title: t.title,
        plannedMinutes,
        actualMinutes,
        deltaMinutes,
      };
    })
    .filter((entry) => entry.plannedMinutes > 0 || entry.actualMinutes > 0);

  const entriesWithActual = timeByTask.filter((entry) => entry.actualMinutes > 0);
  const totalFocusMinutes = entriesWithActual.reduce(
    (sum, entry) => sum + entry.actualMinutes,
    0
  );
  const averageFocusMinutes =
    entriesWithActual.length === 0
      ? 0
      : Math.round(totalFocusMinutes / entriesWithActual.length);

  const totalPlannedMinutes = timeByTask.reduce(
    (sum, entry) => sum + entry.plannedMinutes,
    0
  );
  const totalActualMinutes = timeByTask.reduce(
    (sum, entry) => sum + entry.actualMinutes,
    0
  );
  const netDeltaMinutes = totalActualMinutes - totalPlannedMinutes;
  const overSpentCount = timeByTask.filter((entry) => entry.deltaMinutes > 0).length;
  const underSpentCount = timeByTask.filter((entry) => entry.deltaMinutes < 0).length;

  const focusSubjectTotals = tasks.reduce(
    (acc: Record<string, number>, task: Task) => {
      const minutes = Math.round((focusMap[task.id] ?? 0) / 60000);
      if (minutes > 0) {
        const subject = task.subject ?? "Uncategorized";
        acc[subject] = (acc[subject] ?? 0) + minutes;
      }
      return acc;
    },
    {}
  );
  const focusBySubject: { subject: string; minutes: number }[] = Object.entries(
    focusSubjectTotals
  ).map(([subject, minutes]) => ({ subject, minutes: Number(minutes) }));

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
      plannedBar: isDark ? "#a5b4fc" : "#c4b5fd",
      actualBar: isDark ? "#34d399" : "#4ade80",
      pie: isDark
        ? ["#34d399", "#60a5fa", "#fbbf24", "#fb923c"]
        : ["#8884d8", "#82ca9d", "#ffc658", "#ff8042"],
    }),
    [isDark]
  );

  if (error) {
    return <main>Failed to load stats</main>;
  }
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

  const courseGradeSummaries = (coursesData as CourseSummary[]).map((course) => {
    const gradeAverage = (course as unknown as { gradeAverage?: number | null })
      .gradeAverage ?? null;
    const gradeMeta = percentageToLetterGrade(gradeAverage);
    const gradePoints = percentageToGpa(gradeAverage);
    const creditHours = (course as unknown as { creditHours?: number | null }).creditHours ?? null;
    const gradedTaskCount = (course as unknown as { gradedTaskCount?: number })
      .gradedTaskCount ?? 0;
    const qualityPoints =
      gradePoints != null && typeof creditHours === "number"
        ? gradePoints * creditHours
        : null;
    return {
      id: course.id,
      title: course.title,
      gradeAverage,
      letter: gradeMeta?.letter ?? null,
      gradePoints,
      creditHours,
      qualityPoints,
      gradedTaskCount,
    };
  });

  const gradedCourses = courseGradeSummaries.filter(
    (course) => typeof course.gradeAverage === "number"
  );
  const weightForCourse = (course: (typeof courseGradeSummaries)[number]) => {
    const hours = course.creditHours;
    return typeof hours === "number" && hours > 0 ? hours : 1;
  };
  const totalGradeWeight = gradedCourses.reduce(
    (sum, course) => sum + weightForCourse(course),
    0
  );
  const weightedGradePercentSum = gradedCourses.reduce(
    (sum, course) =>
      sum + (course.gradeAverage ?? 0) * weightForCourse(course),
    0
  );
  const weightedGradePointSum = gradedCourses.reduce(
    (sum, course) =>
      sum + (course.gradePoints ?? 0) * weightForCourse(course),
    0
  );
  const averageCourseGrade =
    totalGradeWeight > 0 ? weightedGradePercentSum / totalGradeWeight : null;
  const overallGpa =
    totalGradeWeight > 0 ? weightedGradePointSum / totalGradeWeight : null;
  const coursesWithGrades = gradedCourses.length;

  const handleExport = () => {
    const exportCourseGrades = courseGradeSummaries.map((course) => ({
      courseId: course.id,
      title: course.title,
      gradeAverage: course.gradeAverage ?? null,
      letter: course.letter ?? null,
      creditHours: course.creditHours ?? null,
      gradePoints: course.gradePoints ?? null,
      qualityPoints: course.qualityPoints ?? null,
      gradedTaskCount: course.gradedTaskCount,
    }));
    exportStatsToCSV({
      tasks,
      statusData,
      subjectData,
      timeByTask,
      courseGrades: exportCourseGrades,
      gpa: overallGpa ?? undefined,
    });
  };

  const pageContent = (
    <main className="space-y-6 text-neutral-900 dark:text-neutral-100">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Task Statistics</h1>
        <div className="flex items-center gap-3">
          <TaskFilterTabs
            value={filter}
            onChange={setFilter}
            subject={subject}
            onSubjectChange={setSubject}
          />
          <Button onClick={handleExport}>Export CSV</Button>
        </div>
      </header>

      <section className="flex items-end gap-2">
        <label className="flex flex-col text-sm">
          <span>Start</span>
          <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label className="flex flex-col text-sm">
            <span>End</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<List className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
          label="Total Tasks"
          value={total}
        />
        <StatCard
          icon={
            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
          }
          label="Completion Rate"
          value={`${completionRate}%`}
        />
        <StatCard
          icon={<List className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
          label="Avg Focus (m)"
          value={averageFocusMinutes}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<GraduationCap className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
          label="Overall GPA"
          value={overallGpa != null ? overallGpa.toFixed(2) : "—"}
        />
        <StatCard
          icon={<Award className="h-6 w-6 text-amber-600 dark:text-amber-400" />}
          label="Courses with grades"
          value={coursesWithGrades}
        />
        <StatCard
          icon={<TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />}
          label="Avg course grade"
          value={
            averageCourseGrade != null
              ? `${averageCourseGrade.toFixed(1)}%`
              : "—"
          }
        />
      </section>

      <section className="space-y-3 rounded-lg border bg-white p-4 shadow-sm dark:bg-neutral-900">
        <div className="space-y-1">
          <h2 className="text-xl font-medium">Course Grades</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Monitor graded assessments and how they contribute to your GPA.
          </p>
        </div>
        {courseGradeSummaries.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            No graded assessments yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-700">
              <thead className="bg-neutral-50 dark:bg-neutral-800">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Course
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Grade
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Letter
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Credit hours
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Grade pts
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Quality pts
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Graded tasks
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {courseGradeSummaries.map((course) => (
                  <tr key={course.id} className="bg-white dark:bg-neutral-900">
                    <td className="px-3 py-2 font-medium">{course.title}</td>
                    <td className="px-3 py-2">
                      {course.gradeAverage != null
                        ? `${course.gradeAverage.toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="px-3 py-2">{course.letter ?? "—"}</td>
                    <td className="px-3 py-2">
                      {typeof course.creditHours === "number"
                        ? course.creditHours
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {course.gradePoints != null
                        ? course.gradePoints.toFixed(2)
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {course.qualityPoints != null
                        ? course.qualityPoints.toFixed(2)
                        : "—"}
                    </td>
                    <td className="px-3 py-2">{course.gradedTaskCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
          <section>
            <div className="space-y-2 rounded-lg border p-4 shadow-sm bg-white dark:bg-neutral-900">
              <h2 className="text-xl font-medium">By Status</h2>
              <ul>
                {statusData.map((s) => (
                  <li key={s.status}>
                    {s.status}: {s.count}
                  </li>
                ))}
              </ul>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={statusData}>
                  <XAxis
                    dataKey="status"
                    stroke={chartColors.axis}
                    tick={{ fill: chartColors.text }}
                  >
                    <Label value="Status" position="insideBottom" fill={chartColors.text} />
                  </XAxis>
                  <YAxis
                    allowDecimals={false}
                    stroke={chartColors.axis}
                    tick={{ fill: chartColors.text }}
                  >
                    <Label
                      value="Count"
                      angle={-90}
                      position="insideLeft"
                      fill={chartColors.text}
                    />
                  </YAxis>
                  <Tooltip />
                  <Legend wrapperStyle={{ color: chartColors.text }} />
                  <Bar
                    dataKey="count"
                    onClick={(data: any) =>
                      router.push(`/?status=${encodeURIComponent(data.status as string)}`)
                    }
                    className="cursor-pointer"
                  >
                    {statusData.map((s) => (
                      <Cell
                        key={s.status}
                        fill={chartColors.bar[s.status as keyof typeof chartColors.bar]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section>
            <div className="space-y-2 rounded-lg border p-4 shadow-sm bg-white dark:bg-neutral-900">
              <h2 className="text-xl font-medium">Focus Time by Subject</h2>
              <ul>
                {focusBySubject.map((s) => (
                  <li key={s.subject}>
                    {s.subject}: {s.minutes}m
                  </li>
                ))}
              </ul>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={focusBySubject}>
                  <XAxis
                    dataKey="subject"
                    stroke={chartColors.axis}
                    tick={{ fill: chartColors.text }}
                  >
                    <Label value="Subject" position="insideBottom" fill={chartColors.text} />
                  </XAxis>
                  <YAxis
                    allowDecimals={false}
                    stroke={chartColors.axis}
                    tick={{ fill: chartColors.text }}
                  >
                    <Label
                      value="Minutes"
                      angle={-90}
                      position="insideLeft"
                      fill={chartColors.text}
                    />
                  </YAxis>
                  <Tooltip />
                  <Legend wrapperStyle={{ color: chartColors.text }} />
                  <Bar dataKey="minutes" fill={chartColors.actualBar} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section>
            <div className="space-y-2 rounded-lg border p-4 shadow-sm bg-white dark:bg-neutral-900">
              <h2 className="text-xl font-medium">By Subject</h2>
              <ul>
                {subjectData.map((s) => (
                  <li key={s.subject}>
                    {s.subject}: {s.count}
                  </li>
                ))}
              </ul>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={subjectData}
                    dataKey="count"
                    nameKey="subject"
                    outerRadius={80}
                    onClick={(data: any) =>
                      router.push(
                        `/?subject=${encodeURIComponent(data.subject as string)}`
                      )
                    }
                    className="cursor-pointer"
                  >
                    {subjectData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={chartColors.pie[index % chartColors.pie.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ color: chartColors.text }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section>
            <div className="space-y-3 rounded-lg border p-4 shadow-sm bg-white dark:bg-neutral-900">
              <div className="space-y-1">
                <h2 className="text-xl font-medium">Planned vs Actual by Task</h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Compare estimated effort to recorded focus time to spot over- or under-spent work.
                </p>
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <div className="rounded-md bg-neutral-100 p-3 dark:bg-neutral-800">
                  <p className="text-neutral-500 dark:text-neutral-400">Total planned</p>
                  <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    {totalPlannedMinutes}m
                  </p>
                </div>
                <div className="rounded-md bg-neutral-100 p-3 dark:bg-neutral-800">
                  <p className="text-neutral-500 dark:text-neutral-400">Total actual</p>
                  <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    {totalActualMinutes}m
                  </p>
                </div>
                <div className="rounded-md bg-neutral-100 p-3 dark:bg-neutral-800">
                  <p className="text-neutral-500 dark:text-neutral-400">Net delta</p>
                  <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    {netDeltaMinutes > 0 ? "+" : ""}
                    {netDeltaMinutes}m
                  </p>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    Over plan: {overSpentCount} • Under plan: {underSpentCount}
                  </p>
                </div>
              </div>
              <ul className="space-y-1 text-sm">
                {timeByTask.map((task) => (
                  <li key={task.id}>
                    {task.title}: planned {task.plannedMinutes}m • actual {task.actualMinutes}m • {" "}
                    {task.deltaMinutes > 0 ? "+" : ""}
                    {task.deltaMinutes}m
                  </li>
                ))}
              </ul>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={timeByTask}>
                  <XAxis
                    dataKey="title"
                    stroke={chartColors.axis}
                    tick={{ fill: chartColors.text }}
                  >
                    <Label value="Task" position="insideBottom" fill={chartColors.text} />
                  </XAxis>
                  <YAxis
                    allowDecimals={false}
                    stroke={chartColors.axis}
                    tick={{ fill: chartColors.text }}
                  >
                    <Label
                      value="Minutes"
                      angle={-90}
                      position="insideLeft"
                      fill={chartColors.text}
                    />
                  </YAxis>
                  <Tooltip />
                  <Legend wrapperStyle={{ color: chartColors.text }} />
                  <Bar dataKey="plannedMinutes" name="Planned" fill={chartColors.plannedBar} />
                  <Bar dataKey="actualMinutes" name="Actual" fill={chartColors.actualBar} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      </main>
  );

  return (
    <ErrorBoundary fallback={<main>Failed to load stats</main>}>
      {pageContent}
    </ErrorBoundary>
  );
}

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
import { computeGoalProgress } from "@/lib/goal-progress";
import type { GoalProgress as GoalProgressEntry } from "@/lib/goal-progress";
import { toast } from "@/lib/toast";
import { ErrorBoundary } from "@/components/error-boundary";
import { StatCard } from "@/components/ui/stat-card";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { TaskFilterTabs, type TaskFilter } from "@/components/task-filter-tabs";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, List, Target, GraduationCap, Award, TrendingUp } from "lucide-react";
import { percentageToGpa, percentageToLetterGrade } from "@/lib/grades";

type Task = RouterOutputs["task"]["list"][number];
type StudyGoal = RouterOutputs["user"]["listGoals"][number];
type CourseSummary = RouterOutputs["course"]["list"][number];

const buildGoalKey = (type: StudyGoal["type"], identifier: string | null) =>
  `${type}:${identifier ?? ""}`;

const goalKeyFromGoal = (goal: Pick<StudyGoal, "type" | "subject" | "courseId">) =>
  goal.type === "COURSE"
    ? buildGoalKey("COURSE", goal.courseId ?? null)
    : buildGoalKey("SUBJECT", goal.subject ?? "Uncategorized");

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
  const tasks = React.useMemo<RouterOutputs["task"]["list"]>(() => data ?? [], [data]);
  const { data: focusData } = api.focus.aggregate.useQuery(range);
  const utils = api.useContext();
  const { data: goalsData } = api.user.listGoals.useQuery(undefined, {
    enabled: !!session,
  });
  const { data: coursesData } = api.course.list.useQuery(
    { page: 1, limit: 100 },
    { enabled: !!session }
  );
  const goals = React.useMemo<StudyGoal[]>(() => goalsData ?? [], [goalsData]);
  const courses = React.useMemo<CourseSummary[]>(() => coursesData ?? [], [coursesData]);
  const upsertGoal = api.user.upsertGoal.useMutation({
    onSuccess: async () => {
      await utils.user.listGoals.invalidate();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to save goal.");
    },
  });
  const deleteGoal = api.user.deleteGoal.useMutation({
    onSuccess: async () => {
      await utils.user.listGoals.invalidate();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to delete goal.");
    },
  });
  const [goalDrafts, setGoalDrafts] = React.useState<Record<string, string>>({});
  const [newSubject, setNewSubject] = React.useState("");
  const [newSubjectTarget, setNewSubjectTarget] = React.useState("");
  const [newCourseId, setNewCourseId] = React.useState("");
  const [newCourseTarget, setNewCourseTarget] = React.useState("");
  const isMutatingGoal = upsertGoal.isLoading || deleteGoal.isLoading;

  React.useEffect(() => {
    if (!goalsData) return;
    setGoalDrafts(() => {
      const next: Record<string, string> = {};
      for (const goal of goalsData) {
        const key = goalKeyFromGoal(goal);
        next[key] = goal.targetMinutes.toString();
      }
      return next;
    });
  }, [goalsData]);

  const parseMinutes = React.useCallback((value: string | undefined) => {
    if (typeof value === "undefined" || value.trim() === "") return 0;
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 0) return Number.NaN;
    return parsed;
  }, []);

  const handleDraftChange = React.useCallback((key: string, value: string) => {
    setGoalDrafts((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSaveGoal = React.useCallback(
    async (type: StudyGoal["type"], identifier: string, label: string) => {
      const key = buildGoalKey(type, identifier);
      const minutes = parseMinutes(goalDrafts[key]);
      if (Number.isNaN(minutes)) {
        toast.error("Enter a non-negative number of minutes.");
        return;
      }
      try {
        await upsertGoal.mutateAsync({
          type,
          targetMinutes: minutes,
          subject: type === "SUBJECT" ? identifier : undefined,
          courseId: type === "COURSE" ? identifier : undefined,
        });
        toast.success(`Saved goal for ${label}.`);
      } catch {
        // Error handled via mutation onError
      }
    },
    [goalDrafts, parseMinutes, upsertGoal]
  );

  const handleDeleteGoal = React.useCallback(
    async (goal: StudyGoal) => {
      const key = goalKeyFromGoal(goal);
      try {
        await deleteGoal.mutateAsync({ id: goal.id });
        setGoalDrafts((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        toast.success(`Removed goal for ${goal.label}.`);
      } catch {
        // Error handled via mutation onError
      }
    },
    [deleteGoal]
  );

  const handleAddSubjectGoal = React.useCallback(async () => {
    const subjectName = newSubject.trim();
    const minutes = parseMinutes(newSubjectTarget);
    if (!subjectName) {
      toast.error("Enter a subject name.");
      return;
    }
    if (Number.isNaN(minutes)) {
      toast.error("Enter a non-negative number of minutes.");
      return;
    }
    try {
      await upsertGoal.mutateAsync({
        type: "SUBJECT",
        subject: subjectName,
        targetMinutes: minutes,
      });
      toast.success(`Saved goal for ${subjectName}.`);
      setNewSubject("");
      setNewSubjectTarget("");
    } catch {
      // Error handled via mutation onError
    }
  }, [newSubject, newSubjectTarget, parseMinutes, upsertGoal]);

  const handleAddCourseGoal = React.useCallback(async () => {
    const minutes = parseMinutes(newCourseTarget);
    if (!newCourseId) {
      toast.error("Select a course.");
      return;
    }
    if (Number.isNaN(minutes)) {
      toast.error("Enter a non-negative number of minutes.");
      return;
    }
    const courseName = courses
      .find((course) => course.id === newCourseId)
      ?.title?.trim() ?? "Course";
    try {
      await upsertGoal.mutateAsync({
        type: "COURSE",
        courseId: newCourseId,
        targetMinutes: minutes,
      });
      toast.success(`Saved goal for ${courseName}.`);
      setNewCourseId("");
      setNewCourseTarget("");
    } catch {
      // Error handled via mutation onError
    }
  }, [courses, newCourseId, newCourseTarget, parseMinutes, upsertGoal]);
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

  const focusSubjectTotals = React.useMemo(() => {
    const totals: Record<string, number> = {};
    for (const task of tasks) {
      const minutes = Math.round((focusMap[task.id] ?? 0) / 60000);
      if (minutes > 0) {
        const subjectName = task.subject ?? "Uncategorized";
        totals[subjectName] = (totals[subjectName] ?? 0) + minutes;
      }
    }
    return totals;
  }, [tasks, focusMap]);
  const focusBySubject: { subject: string; minutes: number }[] = React.useMemo(
    () =>
      Object.entries(focusSubjectTotals).map(([subject, minutes]) => ({
        subject,
        minutes: Number(minutes),
      })),
    [focusSubjectTotals]
  );

  const courseFocusTotals = React.useMemo(() => {
    const totals: Record<string, number> = {};
    for (const task of tasks) {
      if (!task.courseId) continue;
      const minutes = Math.round((focusMap[task.id] ?? 0) / 60000);
      if (minutes > 0) {
        totals[task.courseId] = (totals[task.courseId] ?? 0) + minutes;
      }
    }
    return totals;
  }, [tasks, focusMap]);

  const goalMap = React.useMemo(() => {
    const map = new Map<string, StudyGoal>();
    for (const goal of goals) {
      map.set(goalKeyFromGoal(goal), goal);
    }
    return map;
  }, [goals]);

  const goalProgress = React.useMemo(
    () =>
      computeGoalProgress(goals, {
        subjects: focusSubjectTotals,
        courses: courseFocusTotals,
      }),
    [goals, focusSubjectTotals, courseFocusTotals]
  );

  const goalProgressMap = React.useMemo(() => {
    const map = new Map<string, GoalProgressEntry>();
    for (const progress of goalProgress) {
      map.set(progress.id, progress);
    }
    return map;
  }, [goalProgress]);

  const behindGoals = goalProgress.filter((progress) => progress.isBehind);
  const goalsOnTrack = goalProgress.length - behindGoals.length;

  const allSubjects = React.useMemo(() => {
    const set = new Set<string>();
    for (const task of tasks) {
      const subjectName = task.subject ?? "Uncategorized";
      set.add(subjectName);
    }
    for (const goal of goals) {
      if (goal.type === "SUBJECT" && goal.subject) {
        set.add(goal.subject);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tasks, goals]);

  const courseNameMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) {
      if (task.course) {
        map.set(task.course.id, task.course.title);
      }
    }
    for (const goal of goals) {
      if (goal.type === "COURSE" && goal.courseId) {
        map.set(goal.courseId, goal.course?.title ?? goal.label ?? goal.courseId);
      }
    }
    for (const course of courses) {
      map.set(course.id, course.title);
    }
    return map;
  }, [tasks, goals, courses]);

  const courseRows = React.useMemo(
    () =>
      Array.from(courseNameMap.entries()).sort((a, b) =>
        a[1].localeCompare(b[1])
      ),
    [courseNameMap]
  );

  const goalChartData = React.useMemo(
    () =>
      goalProgress
        .slice()
        .sort((a, b) => b.targetMinutes - a.targetMinutes)
        .slice(0, 10)
        .map((goal) => ({
          key: goal.id,
          label: goal.label,
          targetMinutes: goal.targetMinutes,
          actualMinutes: goal.actualMinutes,
        })),
    [goalProgress]
  );

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

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-4">
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
        <StatCard
          icon={<Target className="h-6 w-6 text-purple-600 dark:text-purple-400" />}
          label="Goals On Track"
          value={
            goalProgress.length === 0
              ? "0"
              : `${goalsOnTrack}/${goalProgress.length}`
          }
        />
      </section>

      <section className="space-y-4 rounded-lg border p-4 shadow-sm bg-white dark:bg-neutral-900">
        <div className="space-y-1">
          <h2 className="text-xl font-medium">Weekly Focus Goals</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Track how actual focus time compares to the weekly targets you set.
          </p>
        </div>
        {behindGoals.length > 0 && (
          <Alert
            variant="error"
            className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-50 p-3 text-sm text-red-700 dark:border-red-400/40 dark:bg-red-950/30 dark:text-red-200"
          >
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <div>
              <p className="font-semibold">
                {behindGoals.length === 1
                  ? "You're behind on 1 focus goal."
                  : `You're behind on ${behindGoals.length} focus goals.`}
              </p>
              <ul className="ml-4 list-disc space-y-1">
                {behindGoals.map((goal) => (
                  <li key={goal.id}>
                    {goal.label}: {goal.remainingMinutes} more minutes needed this week.
                  </li>
                ))}
              </ul>
            </div>
          </Alert>
        )}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Subjects</h3>
              <table className="w-full border-separate border-spacing-y-2 text-sm">
                <thead className="text-left text-neutral-600 dark:text-neutral-400">
                  <tr>
                    <th className="px-2 py-1">Subject</th>
                    <th className="px-2 py-1">Target (m)</th>
                    <th className="px-2 py-1 text-center">Actual (m)</th>
                    <th className="px-2 py-1 text-center">Progress</th>
                    <th className="px-2 py-1 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allSubjects.map((name) => {
                    const key = buildGoalKey("SUBJECT", name);
                    const goal = goalMap.get(key) ?? null;
                    const progress = goal ? goalProgressMap.get(goal.id) ?? null : null;
                    const draftValue =
                      goalDrafts[key] ?? (goal ? goal.targetMinutes.toString() : "");
                    const actual = Math.round(focusSubjectTotals[name] ?? 0);
                    return (
                      <tr
                        key={key}
                        className="rounded-md bg-neutral-50 text-neutral-900 dark:bg-neutral-800/70 dark:text-neutral-100"
                      >
                        <td className="rounded-l-md px-2 py-2 font-medium">{name}</td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min={0}
                            className="h-9 w-full"
                            value={draftValue}
                            onChange={(e) => handleDraftChange(key, e.target.value)}
                            disabled={isMutatingGoal}
                          />
                        </td>
                        <td className="px-2 py-2 text-center">{actual}</td>
                        <td className="px-2 py-2 text-center">
                          {progress ? `${progress.progressPercent}%` : "—"}
                        </td>
                        <td className="rounded-r-md px-2 py-2">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              onClick={() => handleSaveGoal("SUBJECT", name, name)}
                              disabled={isMutatingGoal}
                            >
                              Save
                            </Button>
                            {goal ? (
                              <Button
                                type="button"
                                variant="tertiary"
                                onClick={() => handleDeleteGoal(goal)}
                                disabled={isMutatingGoal}
                              >
                                Remove
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {allSubjects.length === 0 && (
                    <tr>
                      <td
                        className="px-2 py-4 text-center text-neutral-500 dark:text-neutral-400"
                        colSpan={5}
                      >
                        No subjects yet. Create a task to start tracking goals.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Add Subject Goal</h3>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <Input
                  placeholder="Subject name"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  disabled={isMutatingGoal}
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="Minutes"
                  value={newSubjectTarget}
                  onChange={(e) => setNewSubjectTarget(e.target.value)}
                  disabled={isMutatingGoal}
                />
                <Button
                  type="button"
                  onClick={handleAddSubjectGoal}
                  disabled={isMutatingGoal}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Courses</h3>
              <table className="w-full border-separate border-spacing-y-2 text-sm">
                <thead className="text-left text-neutral-600 dark:text-neutral-400">
                  <tr>
                    <th className="px-2 py-1">Course</th>
                    <th className="px-2 py-1">Target (m)</th>
                    <th className="px-2 py-1 text-center">Actual (m)</th>
                    <th className="px-2 py-1 text-center">Progress</th>
                    <th className="px-2 py-1 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {courseRows.map(([courseId, title]) => {
                    const key = buildGoalKey("COURSE", courseId);
                    const goal = goalMap.get(key) ?? null;
                    const progress = goal ? goalProgressMap.get(goal.id) ?? null : null;
                    const draftValue =
                      goalDrafts[key] ?? (goal ? goal.targetMinutes.toString() : "");
                    const actual = Math.round(courseFocusTotals[courseId] ?? 0);
                    return (
                      <tr
                        key={key}
                        className="rounded-md bg-neutral-50 text-neutral-900 dark:bg-neutral-800/70 dark:text-neutral-100"
                      >
                        <td className="rounded-l-md px-2 py-2 font-medium">{title}</td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min={0}
                            className="h-9 w-full"
                            value={draftValue}
                            onChange={(e) => handleDraftChange(key, e.target.value)}
                            disabled={isMutatingGoal}
                          />
                        </td>
                        <td className="px-2 py-2 text-center">{actual}</td>
                        <td className="px-2 py-2 text-center">
                          {progress ? `${progress.progressPercent}%` : "—"}
                        </td>
                        <td className="rounded-r-md px-2 py-2">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              onClick={() => handleSaveGoal("COURSE", courseId, title)}
                              disabled={isMutatingGoal}
                            >
                              Save
                            </Button>
                            {goal ? (
                              <Button
                                type="button"
                                variant="tertiary"
                                onClick={() => handleDeleteGoal(goal)}
                                disabled={isMutatingGoal}
                              >
                                Remove
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {courseRows.length === 0 && (
                    <tr>
                      <td
                        className="px-2 py-4 text-center text-neutral-500 dark:text-neutral-400"
                        colSpan={5}
                      >
                        No courses yet. Add a course to start tracking goals.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Add Course Goal</h3>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <select
                  className="h-9 rounded border border-neutral-300 bg-white px-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                  value={newCourseId}
                  onChange={(e) => setNewCourseId(e.target.value)}
                  disabled={isMutatingGoal}
                >
                  <option value="">Select course</option>
                  {courseRows.map(([courseId, title]) => (
                    <option key={courseId} value={courseId}>
                      {title}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  min={0}
                  placeholder="Minutes"
                  value={newCourseTarget}
                  onChange={(e) => setNewCourseTarget(e.target.value)}
                  disabled={isMutatingGoal}
                />
                <Button
                  type="button"
                  onClick={handleAddCourseGoal}
                  disabled={isMutatingGoal}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
        {goalChartData.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Actual vs Target (Top goals)</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={goalChartData}>
                <XAxis
                  dataKey="label"
                  stroke={chartColors.axis}
                  tick={{ fill: chartColors.text }}
                >
                  <Label value="Goal" position="insideBottom" fill={chartColors.text} />
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
                <Bar dataKey="targetMinutes" name="Target" fill={chartColors.plannedBar} />
                <Bar dataKey="actualMinutes" name="Actual" fill={chartColors.actualBar} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

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

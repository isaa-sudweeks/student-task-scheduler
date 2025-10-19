import { useSession } from "next-auth/react";
import { useMemo, useState, useEffect, useRef } from "react";
import type { inferRouterInputs } from "@trpc/server";
import { api } from "@/server/api/react";
import type { RouterOutputs, AppRouter } from "@/server/api/root";
import type { TaskStatus } from "@/components/status-dropdown";

export type RouterInputs = inferRouterInputs<AppRouter>;
export type TaskListQueryInput = Partial<RouterInputs["task"]["list"]>;
export type Task = RouterOutputs["task"]["list"][number];
export type Priority = "LOW" | "MEDIUM" | "HIGH";

interface Options {
  filter: "all" | "overdue" | "today" | "archive";
  subject: string | null;
  status: TaskStatus | null;
  priority: Priority | null;
  courseId: string | null;
  projectId: string | null;
}

export function useTaskListQuery({
  filter,
  subject,
  status,
  priority,
  courseId,
  projectId,
}: Options) {
  const user = api.user.get.useQuery();
  const { data: session } = useSession();

  const queryInput = useMemo(() => {
    const base: TaskListQueryInput = {
      filter,
      subject: subject ?? undefined,
      status: status ?? undefined,
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
  }, [filter, subject, status, priority, courseId, projectId, user.data?.timezone]);

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

  const flatTasks = useMemo(() => tasks.data?.pages.flat() ?? [], [tasks.data]);

  const [taskDataSnapshot, setTaskDataSnapshot] = useState<Task[]>();
  const prevFilterRef = useRef(filter);
  useEffect(() => {
    if (flatTasks.length === 0) {
      prevFilterRef.current = filter;
      setTaskDataSnapshot((prev) => {
        if (prev && prev.length === 0) {
          return prev;
        }
        return [];
      });
      return;
    }
    if (taskDataSnapshot === undefined || prevFilterRef.current !== filter) {
      setTaskDataSnapshot(flatTasks);
      prevFilterRef.current = filter;
      return;
    }
    const snapIds = new Set(taskDataSnapshot.map((t) => t.id));
    const dataIds = new Set(flatTasks.map((t) => t.id));
    const idsDiffer =
      snapIds.size !== dataIds.size ||
      [...dataIds].some((id) => !snapIds.has(id));
    if (idsDiffer) {
      setTaskDataSnapshot(flatTasks);
      return;
    }
    const snapById = new Map(taskDataSnapshot.map((t) => [t.id, t]));
    const contentChanged = flatTasks.some((t) => {
      const prev = snapById.get(t.id);
      if (!(t && prev)) return false;
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
  }, [filter, flatTasks, taskDataSnapshot]);

  const taskData = taskDataSnapshot ?? flatTasks;

  return { tasks, flatTasks, taskData };
}


"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { TaskList } from "@/components/task-list";
import { TaskModal } from "@/components/task-modal";
import { Button } from "@/components/ui/button";
import { TaskFilterTabs } from "@/components/task-filter-tabs";
import type { TaskStatus } from "@/components/status-dropdown";
import type { TaskPriority } from "@prisma/client";
// Controls moved to global nav bar: AccountMenu, ThemeToggle, ShortcutsPopover

type Priority = "LOW" | "MEDIUM" | "HIGH";

const FILTER_OPTIONS: Array<"all" | "overdue" | "today" | "archive"> = [
  "all",
  "today",
  "overdue",
  "archive",
];

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageContent />
    </Suspense>
  );
}

function HomePageContent() {
  const [filter, setFilter] = useState<"all" | "overdue" | "today" | "archive">(
    "all"
  );
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status");
  const subjectParam = searchParams.get("subject");
  const status: TaskStatus | null =
    statusParam === "TODO" ||
    statusParam === "IN_PROGRESS" ||
    statusParam === "DONE" ||
    statusParam === "CANCELLED"
      ? (statusParam as TaskStatus)
      : null;
  const [subject, setSubject] = useState<string | null>(subjectParam);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [taskCount, setTaskCount] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSubject(subjectParam);
  }, [subjectParam]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable =
        tag === "input" ||
        tag === "textarea" ||
        (target && target.isContentEditable);
      if (isEditable) return;
      if (
        e.key.toLowerCase() === "n" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.shiftKey
      ) {
        e.preventDefault();
        setShowModal(true);
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const idx = FILTER_OPTIONS.indexOf(filter);
        const nextIndex =
          e.key === "ArrowRight"
            ? (idx + 1) % FILTER_OPTIONS.length
            : (idx - 1 + FILTER_OPTIONS.length) % FILTER_OPTIONS.length;
        setFilter(FILTER_OPTIONS[nextIndex]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filter]);

  return (
    <>
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur dark:bg-slate-950/80">
        <div className="mx-auto max-w-4xl px-3.5 py-2.5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-start gap-3 md:flex-nowrap md:items-center md:gap-4">
            <div className="flex items-center gap-2 md:mr-auto">
              <h1 className="text-2xl font-semibold">Tasks</h1>
              <span className="text-sm text-muted-foreground">· {taskCount}</span>
            </div>
            <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center md:justify-end">
              <div className="flex w-full flex-wrap items-center justify-center gap-2 md:w-auto md:justify-end">
                <TaskFilterTabs
                  value={filter}
                  onChange={setFilter}
                  subject={subject}
                  onSubjectChange={setSubject}
                  priority={priority as TaskPriority | null}
                  onPriorityChange={(value) =>
                    setPriority((value ?? null) as Priority | null)
                  }
                  courseId={courseId}
                  onCourseChange={setCourseId}
                  projectId={projectId}
                  onProjectChange={setProjectId}
                />
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-center md:w-auto md:justify-end">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.currentTarget.value)}
                  placeholder="Search tasks..."
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground sm:w-64 md:w-80"
                  ref={searchRef}
                />
                <Button
                  className="h-9 w-full sm:w-auto"
                  onClick={() => setShowModal(true)}
                >
                  + New Task
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="rounded-xl border bg-white shadow-sm p-4">
          <TaskList
            filter={filter}
            subject={subject}
            status={status}
            priority={priority}
            courseId={courseId}
            projectId={projectId}
            query={query}
            onCountChange={setTaskCount}
          />
        </div>
      </main>
      <TaskModal
        open={showModal}
        mode="create"
        onClose={() => setShowModal(false)}
      />
    </>
  );
}

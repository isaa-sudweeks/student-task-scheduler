"use client";
import React, { useState, Suspense, useEffect } from "react";
import { TaskList } from "@/components/task-list";
import { TaskFilterTabs } from "@/components/task-filter-tabs";
import { TaskModal } from "@/components/task-modal";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/theme-toggle";
import { AccountMenu } from "@/components/account-menu";

type Priority = "LOW" | "MEDIUM" | "HIGH";

export default function HomePage() {
  const [filter, setFilter] = useState<"all" | "overdue" | "today" | "archive">("all");
  const [subject, setSubject] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Global hotkey: press "n" to open New Task modal
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      // Ignore when typing in inputs/textareas or contenteditable
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable =
        tag === "input" ||
        tag === "textarea" ||
        (target && (target as HTMLElement).isContentEditable);
      if (isEditable) return;
      // Only plain "n" without modifiers
      if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setShowModal(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur dark:bg-slate-950/80">
        <div className="mx-auto max-w-4xl space-y-4 px-3.5 py-2.5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Tasks</h1>
            <div className="flex items-center gap-3">
              <Button onClick={() => setShowModal(true)}>New task</Button>
              <ThemeToggle />
              <Suspense fallback={null}>
                <AccountMenu />
              </Suspense>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              placeholder="Search tasks..."
              className="flex-1 rounded-md border bg-transparent px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <TaskFilterTabs
            value={filter}
            onChange={setFilter}
            subject={subject}
            onSubjectChange={setSubject}
            priority={priority}
            onPriorityChange={setPriority}
            courseId={courseId}
            onCourseChange={setCourseId}
            projectId={projectId}
            onProjectChange={setProjectId}
          />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="rounded-xl border bg-white shadow-sm p-4">
          <TaskList
            filter={filter}
            subject={subject}
            priority={priority}
            courseId={courseId}
            projectId={projectId}
            query={query}
          />
        </div>
      </main>
      <TaskModal open={showModal} mode="create" onClose={() => setShowModal(false)} />
    </>
  );
}

"use client";
import React, { useState, useEffect } from "react";
import { TaskList } from "@/components/task-list";
import { TaskModal } from "@/components/task-modal";
import { Button } from "@/components/ui/button";
import { clsx } from "clsx";

type Priority = "LOW" | "MEDIUM" | "HIGH";

export default function HomePage() {
  const [filter, setFilter] = useState<"all" | "overdue" | "today">("all");
  const [subject] = useState<string | null>(null);
  const [priority] = useState<Priority | null>(null);
  const [courseId] = useState<string | null>(null);
  const [projectId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [taskCount, setTaskCount] = useState(0);

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
        <div className="mx-auto max-w-4xl px-3.5 py-2.5 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-3 md:flex-row md:gap-4">
            <div className="flex items-center gap-2 md:mr-auto">
              <h1 className="text-2xl font-semibold">Tasks</h1>
              <span className="text-sm text-muted-foreground">· {taskCount}</span>
            </div>
            <div className="order-last flex items-center gap-3 md:order-none md:ml-auto">
              <Button onClick={() => setShowModal(true)}>+ New Task</Button>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.currentTarget.value)}
                placeholder="Search tasks..."
                className="w-40 md:w-80 rounded-md border bg-transparent px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex justify-center md:mx-auto">
              <div className="inline-flex rounded-lg border bg-white p-1">
                {[
                  { key: "all", label: "All" },
                  { key: "today", label: "Today" },
                  { key: "overdue", label: "Overdue" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key as any)}
                    className={clsx(
                      "rounded-md px-3 py-1 text-sm",
                      filter === tab.key && "bg-neutral-100"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
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
            priority={priority}
            courseId={courseId}
            projectId={projectId}
            query={query}
            onCountChange={setTaskCount}
          />
        </div>
      </main>
      <TaskModal open={showModal} mode="create" onClose={() => setShowModal(false)} />
    </>
  );
}

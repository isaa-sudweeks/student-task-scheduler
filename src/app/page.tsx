import React from "react";
import Link from "next/link";
import { TaskList } from "@/components/task-list";
import { NewTaskForm } from "@/components/new-task-form";
import ThemeToggle from "@/components/theme-toggle";
import { Suspense } from "react";
import { AccountMenu } from "@/components/account-menu";

export default function HomePage() {
  // Auth gating is enforced by next-auth middleware for '/'
  return (
    <main className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Your Tasks</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/calendar"
            className="rounded border px-3 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
            title="Open Calendar"
          >
            Calendar View
          </Link>
          {/* Settings link removed; accessible via AccountMenu */}
          <Link
            href="/stats"
            className="rounded border px-3 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
            title="Open Statistics"
          >
            Statistics
          </Link>
          <ThemeToggle />
          <Suspense fallback={null}>
            <AccountMenu />
          </Suspense>
        </div>
      </header>
      <NewTaskForm />
      <TaskList />
    </main>
  );
}

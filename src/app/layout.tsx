import "./../styles/globals.css";
import React from "react";
import Providers from "./providers";
import NavBar from "@/components/nav-bar";
import FloatingTaskButton from "@/components/floating-task-button";

export const metadata = {
  title: "Student Task Scheduler",
  description: "Plan, prioritize, and finish tasks.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-neutral-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <Providers>
          <NavBar />
          {children}
          <FloatingTaskButton hiddenPaths={["/settings", "/stats"]} />
        </Providers>
      </body>
    </html>
  );
}

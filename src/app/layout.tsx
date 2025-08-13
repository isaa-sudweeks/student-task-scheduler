import "./../styles/globals.css";
import React from "react";
import Providers from "./providers";

export const metadata = {
  title: "Student Task Scheduler",
  description: "Plan, prioritize, and finish tasks.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <Providers>
          <div className="mx-auto max-w-5xl p-6">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}

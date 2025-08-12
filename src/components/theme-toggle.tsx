"use client";
import React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) {
    return null;
  }
  const toggle = () => setTheme(theme === "dark" ? "light" : "dark");
  return (
    <button
      aria-label="Toggle theme"
      className="fixed bottom-4 left-4 z-50 rounded-md border px-3 py-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow hover:bg-white dark:hover:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      onClick={toggle}
      type="button"
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

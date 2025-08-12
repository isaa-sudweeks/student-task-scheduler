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
      className="rounded border px-3 py-2"
      onClick={toggle}
      type="button"
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

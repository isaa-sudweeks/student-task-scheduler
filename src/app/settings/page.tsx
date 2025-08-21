"use client";
import React from "react";
import ThemeToggle from "@/components/theme-toggle";

export default function SettingsPage() {
  const [startHour, setStartHour] = React.useState(8);
  const [endHour, setEndHour] = React.useState(18);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const storedStart = window.localStorage.getItem("dayWindowStartHour");
    const storedEnd = window.localStorage.getItem("dayWindowEndHour");
    if (storedStart) setStartHour(Number(storedStart));
    if (storedEnd) setEndHour(Number(storedEnd));
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("dayWindowStartHour", String(startHour));
  }, [startHour]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("dayWindowEndHour", String(endHour));
  }, [endHour]);

  return (
    <main className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <ThemeToggle />
      </header>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <label htmlFor="day-start" className="w-48">
            Day start hour
          </label>
          <input
            id="day-start"
            type="number"
            min={0}
            max={23}
            value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))}
            className="w-20 rounded border px-2 py-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="day-end" className="w-48">
            Day end hour
          </label>
          <input
            id="day-end"
            type="number"
            min={0}
            max={23}
            value={endHour}
            onChange={(e) => setEndHour(Number(e.target.value))}
            className="w-20 rounded border px-2 py-1"
          />
        </div>
      </div>
    </main>
  );
}

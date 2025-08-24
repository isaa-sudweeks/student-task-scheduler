"use client";
import React from "react";
import ThemeToggle from "@/components/theme-toggle";
import { AccountMenu } from "@/components/account-menu";
import { api } from "@/server/api/react";
import { toast } from "react-hot-toast";

export default function SettingsPage() {
  // Day window (localStorage)
  const [startHour, setStartHour] = React.useState(8);
  const [endHour, setEndHour] = React.useState(18);
  const [defaultDuration, setDefaultDuration] = React.useState(30);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const storedStart = window.localStorage.getItem("dayWindowStartHour");
    const storedEnd = window.localStorage.getItem("dayWindowEndHour");
    const storedDuration = window.localStorage.getItem("defaultDurationMinutes");
    if (storedStart) setStartHour(Number(storedStart));
    if (storedEnd) setEndHour(Number(storedEnd));
    if (storedDuration) setDefaultDuration(Number(storedDuration));
  }, []);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("dayWindowStartHour", String(startHour));
  }, [startHour]);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("dayWindowEndHour", String(endHour));
  }, [endHour]);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("defaultDurationMinutes", String(defaultDuration));
  }, [defaultDuration]);

  // Google Calendar sync toggle (localStorage)
  const [syncEnabled, setSyncEnabled] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    setSyncEnabled(window.localStorage.getItem("googleSyncEnabled") === "true");
  }, []);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("googleSyncEnabled", String(syncEnabled));
  }, [syncEnabled]);

  // User timezone (tRPC)
  const { data: user } = api.user.get.useQuery();
  const [tz, setTz] = React.useState(
    user?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  React.useEffect(() => {
    if (user?.timezone) setTz(user.timezone);
  }, [user?.timezone]);
  const update = api.user.setTimezone.useMutation({
    onSuccess: () => toast.success("Timezone updated"),
    onError: (e) => toast.error(e.message || "Failed to update timezone"),
  });
  const zones = React.useMemo(
    () => (Intl.supportedValuesOf ? Intl.supportedValuesOf("timeZone") : [tz]),
    [tz]
  );

  return (
    <main className="space-y-6 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <AccountMenu />
        </div>
      </header>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Scheduling Preferences</h2>
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
        <div className="flex items-center gap-2">
          <label htmlFor="default-duration" className="w-48">
            Default duration (minutes)
          </label>
          <input
            id="default-duration"
            type="number"
            min={1}
            value={defaultDuration}
            onChange={(e) => setDefaultDuration(Number(e.target.value))}
            className="w-20 rounded border px-2 py-1"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Integrations</h2>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={syncEnabled}
            onChange={(e) => setSyncEnabled(e.target.checked)}
          />
          Enable Google Calendar sync
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Timezone</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate({ timezone: tz });
          }}
          className="space-y-2 max-w-md"
        >
          <label className="block">
            <span className="text-sm">Timezone</span>
            <select
              value={tz}
              onChange={(e) => setTz(e.target.value)}
              className="mt-1 block w-full border p-1 rounded"
            >
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="px-3 py-1 border rounded"
            disabled={update.isPending}
          >
            Save
          </button>
        </form>
      </section>
    </main>
  );
}

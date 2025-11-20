"use client";
import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
// Theme and account controls are provided in the global nav bar
import { toast } from "@/lib/toast";
import { api } from "@/server/api/react";

type LlmProviderOption = "NONE" | "OPENAI" | "LM_STUDIO";

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams?.get("returnTo") || "";
  // Day window (localStorage)
  const [startHour, setStartHour] = React.useState(8);
  const [endHour, setEndHour] = React.useState(18);
  const [defaultDuration, setDefaultDuration] = React.useState(30);
  const [focusWorkMinutes, setFocusWorkMinutes] = React.useState(25);
  const [focusBreakMinutes, setFocusBreakMinutes] = React.useState(5);
  const [focusCycleCount, setFocusCycleCount] = React.useState(4);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const storedStart = window.localStorage.getItem("dayWindowStartHour");
    const storedEnd = window.localStorage.getItem("dayWindowEndHour");
    const storedDuration = window.localStorage.getItem("defaultDurationMinutes");
    const storedFocusWork = window.localStorage.getItem("focusWorkMinutes");
    const storedFocusBreak = window.localStorage.getItem("focusBreakMinutes");
    const storedFocusCycles = window.localStorage.getItem("focusCycleCount");
    if (storedStart) setStartHour(Number(storedStart));
    if (storedEnd) setEndHour(Number(storedEnd));
    if (storedDuration) setDefaultDuration(Number(storedDuration));
    if (storedFocusWork) setFocusWorkMinutes(Number(storedFocusWork));
    if (storedFocusBreak) setFocusBreakMinutes(Number(storedFocusBreak));
    if (storedFocusCycles) setFocusCycleCount(Number(storedFocusCycles));
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
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("focusWorkMinutes", String(focusWorkMinutes));
  }, [focusWorkMinutes]);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("focusBreakMinutes", String(focusBreakMinutes));
  }, [focusBreakMinutes]);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("focusCycleCount", String(focusCycleCount));
  }, [focusCycleCount]);

  // Google Calendar sync toggle (localStorage)
  const [syncEnabled, setSyncEnabled] = React.useState(true);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("googleSyncEnabled");
    setSyncEnabled(stored !== "false");
  }, []);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("googleSyncEnabled", String(syncEnabled));
  }, [syncEnabled]);

  // User settings (tRPC)
  type UserSettings = {
    timezone: string;
    dayWindowStartHour: number;
    dayWindowEndHour: number;
    defaultDurationMinutes: number;
    googleSyncEnabled: boolean;
    llmProvider: LlmProviderOption;
    openaiApiKey: string | null;
    lmStudioUrl: string;
    focusWorkMinutes: number;
    focusBreakMinutes: number;
    focusCycleCount: number;
  };
  const settings = api.user.getSettings.useQuery().data as UserSettings | undefined;
  const [tz, setTz] = React.useState(
    settings?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [llmProvider, setLlmProvider] = React.useState<LlmProviderOption>(
    settings?.llmProvider ?? "NONE"
  );
  const [openaiApiKey, setOpenaiApiKey] = React.useState(settings?.openaiApiKey ?? "");
  const [lmStudioUrl, setLmStudioUrl] = React.useState(
    settings?.lmStudioUrl ?? "http://localhost:1234"
  );
  const dayWindowError = React.useMemo(() => {
    return endHour <= startHour
      ? "Day end hour must be later than the start hour."
      : null;
  }, [endHour, startHour]);
  React.useEffect(() => {
    if (!settings) return;
    setTz(settings.timezone);
    setStartHour(settings.dayWindowStartHour);
    setEndHour(settings.dayWindowEndHour);
    setDefaultDuration(settings.defaultDurationMinutes);
    setSyncEnabled(settings.googleSyncEnabled);
    setLlmProvider(settings.llmProvider ?? "NONE");
    setOpenaiApiKey(settings.openaiApiKey ?? "");
    setLmStudioUrl(settings.lmStudioUrl || "http://localhost:1234");
    setFocusWorkMinutes(settings.focusWorkMinutes);
    setFocusBreakMinutes(settings.focusBreakMinutes);
    setFocusCycleCount(settings.focusCycleCount);
    // Keep localStorage in sync for other pages
    if (typeof window !== "undefined") {
      window.localStorage.setItem("dayWindowStartHour", String(settings.dayWindowStartHour));
      window.localStorage.setItem("dayWindowEndHour", String(settings.dayWindowEndHour));
      window.localStorage.setItem("defaultDurationMinutes", String(settings.defaultDurationMinutes));
      window.localStorage.setItem("googleSyncEnabled", String(settings.googleSyncEnabled));
      window.localStorage.setItem("focusWorkMinutes", String(settings.focusWorkMinutes));
      window.localStorage.setItem("focusBreakMinutes", String(settings.focusBreakMinutes));
      window.localStorage.setItem("focusCycleCount", String(settings.focusCycleCount));
    }
  }, [settings]);
  const saveSettings = api.user.setSettings.useMutation({
    onSuccess: () => {
      toast.success("Settings saved.");
      // Prefer explicit returnTo; otherwise, go back. Fallback to /calendar.
      if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
        router.push(returnTo);
      } else {
        // Attempt to go back; if no history, push default
        router.back();
        // as a fallback, ensure navigation to a safe default after a tick
        setTimeout(() => router.push("/calendar"), 50);
      }
    },
    onError: (e) => toast.error(e.message || "Save failed."),
  });
  const zones = React.useMemo(
    () => (Intl.supportedValuesOf ? Intl.supportedValuesOf("timeZone") : [tz]),
    [tz]
  );

  return (
    <main className="space-y-6 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Settings</h1>
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
          {dayWindowError && (
            <p className="text-sm text-red-600" role="alert">
              {dayWindowError}
            </p>
          )}
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
        <div className="flex items-center gap-2">
          <label htmlFor="focus-work" className="w-48">
            Focus work (minutes)
          </label>
          <input
            id="focus-work"
            type="number"
            min={5}
            value={focusWorkMinutes}
            onChange={(e) => setFocusWorkMinutes(Number(e.target.value))}
            className="w-20 rounded border px-2 py-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="focus-break" className="w-48">
            Focus break (minutes)
          </label>
          <input
            id="focus-break"
            type="number"
            min={1}
            value={focusBreakMinutes}
            onChange={(e) => setFocusBreakMinutes(Number(e.target.value))}
            className="w-20 rounded border px-2 py-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="focus-cycles" className="w-48">
            Focus intervals per session
          </label>
          <input
            id="focus-cycles"
            type="number"
            min={1}
            value={focusCycleCount}
            onChange={(e) => setFocusCycleCount(Number(e.target.value))}
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
        <h2 className="text-lg font-medium">AI Assistant</h2>
        <div className="max-w-md space-y-1">
          <label className="block text-sm" htmlFor="llm-provider">
            AI provider
          </label>
          <select
            id="llm-provider"
            value={llmProvider}
            onChange={(e) => setLlmProvider(e.target.value as LlmProviderOption)}
            className="mt-1 block w-full border p-1 rounded"
          >
            <option value="NONE">None</option>
            <option value="OPENAI">OpenAI</option>
            <option value="LM_STUDIO">LM Studio (local)</option>
          </select>
        </div>
        {llmProvider === "OPENAI" && (
          <div className="max-w-md space-y-1">
            <label className="block text-sm" htmlFor="openai-api-key">
              OpenAI API key
            </label>
            <input
              id="openai-api-key"
              type="password"
              autoComplete="off"
              value={openaiApiKey}
              onChange={(e) => setOpenaiApiKey(e.target.value)}
              placeholder="sk-..."
              className="mt-1 w-full rounded border px-2 py-1"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Required to call OpenAI models for scheduling assistance.
            </p>
          </div>
        )}
        <div className="max-w-md space-y-1">
          <label className="block text-sm" htmlFor="lmstudio-url">
            LM Studio URL
          </label>
          <input
            id="lmstudio-url"
            type="url"
            value={lmStudioUrl}
            onChange={(e) => setLmStudioUrl(e.target.value)}
            placeholder="http://localhost:1234"
            className="mt-1 w-full rounded border px-2 py-1 disabled:opacity-50"
            disabled={llmProvider !== "LM_STUDIO"}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Uses LM Studio&#39;s OpenAI-compatible local endpoint.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Timezone</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmedApiKey = openaiApiKey.trim();
            const trimmedLmStudio = lmStudioUrl.trim();
            if (dayWindowError) {
              toast.error(dayWindowError);
              return;
            }
            if (llmProvider === "OPENAI" && !trimmedApiKey) {
              toast.error("Enter your OpenAI API key to use the OpenAI provider.");
              return;
            }
            if (llmProvider === "LM_STUDIO" && !trimmedLmStudio) {
              toast.error("Provide the LM Studio URL to connect to your local model.");
              return;
            }
            const normalizedLmStudioUrl = trimmedLmStudio || "http://localhost:1234";
            if (focusWorkMinutes <= 0 || focusBreakMinutes <= 0 || focusCycleCount <= 0) {
              toast.error("Focus session settings must be positive values.");
              return;
            }
            if (trimmedApiKey !== openaiApiKey) {
              setOpenaiApiKey(trimmedApiKey);
            }
            if (normalizedLmStudioUrl !== lmStudioUrl) {
              setLmStudioUrl(normalizedLmStudioUrl);
            }
            // Persist local preferences immediately
            if (typeof window !== "undefined") {
              window.localStorage.setItem("dayWindowStartHour", String(startHour));
              window.localStorage.setItem("dayWindowEndHour", String(endHour));
              window.localStorage.setItem("defaultDurationMinutes", String(defaultDuration));
              window.localStorage.setItem("googleSyncEnabled", String(syncEnabled));
              window.localStorage.setItem("focusWorkMinutes", String(focusWorkMinutes));
              window.localStorage.setItem("focusBreakMinutes", String(focusBreakMinutes));
              window.localStorage.setItem("focusCycleCount", String(focusCycleCount));
            }

            // Persist all settings via API (always save all fields)
            saveSettings.mutate({
              timezone: tz,
              dayWindowStartHour: startHour,
              dayWindowEndHour: endHour,
              defaultDurationMinutes: defaultDuration,
              googleSyncEnabled: syncEnabled,
              llmProvider,
              openaiApiKey: trimmedApiKey || null,
              lmStudioUrl: normalizedLmStudioUrl,
              focusWorkMinutes,
              focusBreakMinutes,
              focusCycleCount,
            });
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
            disabled={saveSettings.isPending || Boolean(dayWindowError)}
          >
            Save
          </button>
        </form>
      </section>
    </main>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsContent />
    </Suspense>
  );
}

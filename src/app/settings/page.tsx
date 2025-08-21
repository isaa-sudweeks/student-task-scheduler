"use client";

import React from "react";
import { api } from "@/server/api/react";
import { toast } from "react-hot-toast";

export default function SettingsPage() {
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
    <main className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate({ timezone: tz });
        }}
        className="space-y-2"
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
    </main>
  );
}

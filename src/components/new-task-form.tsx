"use client";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/server/api/react";
import { toast } from "react-hot-toast";
import { MoreHorizontal } from "lucide-react";
import { TaskModal } from "@/components/task-modal";

export function NewTaskForm() {
  const utils = api.useUtils();
  const [title, setTitle] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [pendingDueAt, setPendingDueAt] = useState<Date | null>(null);
  const saveSubscription = api.task.saveSubscription.useMutation();

  useEffect(() => {
    async function subscribe() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;
        const reg = await navigator.serviceWorker.register('/sw.js');
        const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key ? urlBase64ToUint8Array(key) : undefined,
        });
        await saveSubscription.mutateAsync(sub.toJSON());
      } catch (err) {
        console.error('push subscribe failed', err);
      }
    }
    void subscribe();
  }, [saveSubscription]);

  const create = api.task.create.useMutation({
    onSuccess: async () => {
      setTitle("");
      setPendingDueAt(null);
      await utils.task.list.invalidate();
    },
    onError: (e) => toast.error(e.message || "Failed to create task"),
  });

  return (
    <div className="flex items-center gap-2">
      <input
        className="flex-1 rounded border border-black/10 bg-transparent px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/10 dark:focus:ring-white/20"
        placeholder="Add a task…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const t = title.trim();
            if (!t) return;
            create.mutate({ title: t });
          }
        }}
      />
      {pendingDueAt && (
        <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800">
          Due {formatDueHint(pendingDueAt)}
        </span>
      )}
      <Button
        variant="secondary"
        aria-label="More options"
        onClick={() => setShowModal(true)}
        title="Add with more options"
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      <TaskModal
        open={showModal}
        mode="create"
        onClose={() => setShowModal(false)}
        initialTitle={title}
        initialDueAt={pendingDueAt}
        onDraftDueChange={setPendingDueAt}
      />
    </div>
  );
}

function formatDueHint(d: Date): string {
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `today ${time}`;
  if (isTomorrow) return `tomorrow ${time}`;
  return d.toLocaleString();
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

"use client";
import React from "react";
import { clsx } from "clsx";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

const STATUS_STYLES: Record<TaskStatus, string> = {
  TODO:
    "bg-neutral-100 text-neutral-700 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:ring-neutral-700",
  IN_PROGRESS:
    "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800",
  DONE:
    "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800",
  CANCELLED:
    "bg-neutral-100 text-neutral-500 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:ring-neutral-700",
};

const DOT_STYLES: Record<TaskStatus, string> = {
  TODO: "bg-neutral-400",
  IN_PROGRESS: "bg-amber-500",
  DONE: "bg-emerald-500",
  CANCELLED: "bg-neutral-400",
};

export interface StatusDropdownProps {
  value: TaskStatus;
  onChange: (next: TaskStatus) => void;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

const STATUSES = Object.keys(STATUS_LABELS) as TaskStatus[];

export function StatusDropdown({ value, onChange, className, disabled, ariaLabel = "Change status" }: StatusDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const index = STATUSES.indexOf(value);
    optionRefs.current[index]?.focus();
  }, [open, value]);

  return (
    <div ref={ref} className={clsx("relative inline-block", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={clsx(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 focus-visible:outline-none focus-visible:ring-2",
          STATUS_STYLES[value],
          disabled && "opacity-60 cursor-not-allowed"
        )}
      >
        <span className={clsx("h-2 w-2 rounded-full", DOT_STYLES[value])} />
        <span>{STATUS_LABELS[value]}</span>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          fill="currentColor"
          className="ml-0.5 h-3 w-3 opacity-60"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={`status-${value}`}
          className="absolute z-50 mt-1 min-w-[8rem] overflow-hidden rounded-md border border-black/10 bg-white p-1 text-xs shadow-lg dark:border-white/10 dark:bg-gray-900"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const options = optionRefs.current;
              const index = options.findIndex((el) => el === document.activeElement);
              const next =
                e.key === "ArrowDown"
                  ? (index + 1) % options.length
                  : (index - 1 + options.length) % options.length;
              options[next]?.focus();
            } else if (e.key === "Enter") {
              e.preventDefault();
              const index = optionRefs.current.findIndex(
                (el) => el === document.activeElement
              );
              const status = STATUSES[index];
              if (status) {
                onChange(status);
                setOpen(false);
                triggerRef.current?.focus();
              }
            } else if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
              triggerRef.current?.focus();
            }
          }}
        >
          {STATUSES.map((s, i) => (
            <li key={s} id={`status-${s}`} role="option" aria-selected={s === value}>
              <button
                ref={(el) => (optionRefs.current[i] = el)}
                type="button"
                className={clsx(
                  "flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-black/5 focus:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:hover:bg-white/10 dark:focus:bg-white/10 dark:focus-visible:ring-white/20",
                )}
                onClick={() => {
                  onChange(s);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
              >
                <span className={clsx("h-2 w-2 rounded-full", DOT_STYLES[s])} />
                <span className="flex-1">{STATUS_LABELS[s]}</span>
                {s === value && (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 opacity-60">
                    <path
                      fillRule="evenodd"
                      d="M16.704 5.29a1 1 0 010 1.415l-7.004 7.004a1 1 0 01-1.414 0L3.296 8.722a1 1 0 011.414-1.415l4.004 4.004 6.297-6.297a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default StatusDropdown;

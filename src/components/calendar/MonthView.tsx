"use client";
import React from 'react';

export function MonthView(props: {
  startOfWeek?: Date;
  events: { id: string; taskId: string; startAt: Date | string; endAt: Date | string; title?: string }[];
}) {
  const days = getMonthDays(props.startOfWeek);
  const first = days[0];
  const startIdx = (first.getDay() + 6) % 7;
  const blanks = Array.from({ length: startIdx }, () => null as null);
  const cells: (Date | null)[] = [...blanks, ...days];
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const ymd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  const eventsByDay = new Map<string, { id: string; title?: string }[]>();
  for (const ev of props.events) {
    const s = new Date(ev.startAt as any);
    const e = new Date(ev.endAt as any);
    const cur = new Date(s);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(e);
    end.setHours(0, 0, 0, 0);
    while (cur <= end) {
      const key = ymd(cur);
      const list = eventsByDay.get(key) ?? [];
      list.push({ id: ev.id, title: ev.title });
      eventsByDay.set(key, list);
      cur.setDate(cur.getDate() + 1);
    }
  }
  return (
    <div className="border rounded overflow-hidden">
      <div className="grid grid-cols-7">
        {weekday.map((w) => (
          <div key={w} className="bg-slate-50 dark:bg-slate-900 p-2 text-xs text-center">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) =>
          d ? (
            <div
              key={d.toDateString()}
              data-testid="day-cell"
              className="h-24 border p-1 text-xs relative"
              aria-label={`month-day-${ymd(d)}`}
            >
              <div
                className={`font-medium mb-1 px-1 inline-flex items-center justify-center rounded ${
                  isSameDay(d, new Date())
                    ? 'bg-blue-600 text-white dark:bg-blue-500'
                    : ''
                }`}
                aria-current={isSameDay(d, new Date()) ? 'date' : undefined}
                title={isSameDay(d, new Date()) ? 'Today' : undefined}
              >
                {d.getDate()}
              </div>
              <div className="space-y-0.5">
                {(eventsByDay.get(ymd(d)) ?? []).map((ev) => (
                  <div
                    key={ev.id}
                    data-testid="month-event"
                    className="truncate rounded bg-blue-100 px-1 py-0.5 text-[10px] leading-3 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100"
                    title={ev.title || 'Event'}
                  >
                    {ev.title || 'Event'}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div key={`blank-${i}`} className="h-24 border p-2 text-xs" />
          )
        )}
      </div>
    </div>
  );
}

function getMonthDays(base?: Date): Date[] {
  const baseDate = base ? new Date(base) : new Date();
  baseDate.setHours(0, 0, 0, 0);
  const year = baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const days: Date[] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }
  return days;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

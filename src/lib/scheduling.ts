export type Interval = { startAt: Date; endAt: Date };

function overlaps(a: Interval, b: Interval): boolean {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}

export function findNonOverlappingSlot(opts: {
  desiredStart: Date;
  durationMinutes: number;
  dayWindowStartHour: number; // local hour bounds
  dayWindowEndHour: number;   // local hour bounds
  existing: Interval[];
  stepMinutes?: number;
}): Interval | null {
  const { desiredStart, durationMinutes, existing, dayWindowStartHour, dayWindowEndHour } = opts;
  const stepMinutes = opts.stepMinutes ?? 15;

  const start = new Date(desiredStart);
  // Constrain start to at/after day window start using local time
  const dayStart = new Date(start);
  dayStart.setHours(dayWindowStartHour, 0, 0, 0);
  const dayEnd = new Date(start);
  dayEnd.setHours(dayWindowEndHour, 0, 0, 0);

  let candidateStart = start < dayStart ? dayStart : start;
  // Round candidate to nearest step increment
  const ms = candidateStart.getTime();
  const stepMs = stepMinutes * 60_000;
  candidateStart = new Date(Math.ceil(ms / stepMs) * stepMs);

  while (candidateStart < dayEnd) {
    const candidateEnd = new Date(candidateStart.getTime() + durationMinutes * 60_000);
    if (candidateEnd > dayEnd) return null;
    const candidate = { startAt: candidateStart, endAt: candidateEnd };
    const hasOverlap = existing.some((e) => overlaps(candidate, e));
    if (!hasOverlap) return candidate;
    candidateStart = new Date(candidateStart.getTime() + stepMs);
  }
  return null;
}

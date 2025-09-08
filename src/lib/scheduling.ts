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

  // Sort and filter relevant intervals to those within the day window
  const relevant = existing
    .filter((e) => e.endAt > dayStart && e.startAt < dayEnd)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  let candidateStart = start < dayStart ? dayStart : start;
  // Round candidate to nearest step increment
  const ms = candidateStart.getTime();
  const stepMs = stepMinutes * 60_000;
  candidateStart = new Date(Math.ceil(ms / stepMs) * stepMs);

  // Iterate through sorted intervals while advancing the candidate slot
  let index = 0;
  while (candidateStart < dayEnd) {
    const candidateEnd = new Date(candidateStart.getTime() + durationMinutes * 60_000);
    if (candidateEnd > dayEnd) return null;
    const candidate = { startAt: candidateStart, endAt: candidateEnd };

    // Skip intervals that end before or at the candidate start
    while (index < relevant.length && relevant[index].endAt <= candidateStart) index++;

    // Check for overlaps with remaining intervals that start before candidate end
    let hasOverlap = false;
    for (let j = index; j < relevant.length && relevant[j].startAt < candidateEnd; j++) {
      if (overlaps(candidate, relevant[j])) {
        hasOverlap = true;
        break;
      }
    }

    if (!hasOverlap) return candidate;
    candidateStart = new Date(candidateStart.getTime() + stepMs);
  }
  return null;
}

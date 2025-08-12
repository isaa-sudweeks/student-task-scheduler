export function defaultEndOfToday(): string {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  return d.toISOString().slice(0, 16);
}

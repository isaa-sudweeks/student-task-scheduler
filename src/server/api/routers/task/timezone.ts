export const computeTodayBounds = (opts: {
  nowUtc: Date;
  timezone?: string | null;
  tzOffsetMinutes?: number | null;
  todayStart?: Date;
  todayEnd?: Date;
}): { startUtc: Date; endUtc: Date } => {
  const { nowUtc, timezone, tzOffsetMinutes, todayStart, todayEnd } = opts;
  if (todayStart && todayEnd) return { startUtc: todayStart, endUtc: todayEnd };
  if (timezone) {
    const nowTz = new Date(nowUtc.toLocaleString('en-US', { timeZone: timezone }));
    const startTz = new Date(nowTz);
    startTz.setHours(0, 0, 0, 0);
    const endTz = new Date(nowTz);
    endTz.setHours(23, 59, 59, 999);
    const startUtc = new Date(startTz.toLocaleString('en-US', { timeZone: 'UTC' }));
    const endUtc = new Date(endTz.toLocaleString('en-US', { timeZone: 'UTC' }));
    return { startUtc, endUtc };
  }
  const nowClient =
    tzOffsetMinutes != null ? new Date(nowUtc.getTime() - tzOffsetMinutes * 60 * 1000) : nowUtc;
  const startClient = new Date(nowClient);
  startClient.setHours(0, 0, 0, 0);
  const endClient = new Date(nowClient);
  endClient.setHours(23, 59, 59, 999);
  const startUtc =
    tzOffsetMinutes != null
      ? new Date(startClient.getTime() + tzOffsetMinutes * 60 * 1000)
      : startClient;
  const endUtc =
    tzOffsetMinutes != null
      ? new Date(endClient.getTime() + tzOffsetMinutes * 60 * 1000)
      : endClient;
  return { startUtc, endUtc };
};

import type { CourseMeeting } from '@prisma/client';
import { Weekday } from '@prisma/client';
import type { Interval } from '@/lib/scheduling';

type MeetingLike = Pick<CourseMeeting, 'dayOfWeek' | 'startMinutes' | 'endMinutes'>;

const WEEKDAY_TO_INDEX: Record<Weekday, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

export const meetingsToIntervalsForDate = (
  meetings: MeetingLike[],
  referenceLocal: Date,
): Interval[] => {
  if (!meetings.length) return [];
  const dayIndex = referenceLocal.getDay();
  const dayStart = new Date(referenceLocal);
  dayStart.setHours(0, 0, 0, 0);
  return meetings
    .filter((meeting) => WEEKDAY_TO_INDEX[meeting.dayOfWeek] === dayIndex)
    .map((meeting) => {
      const startAt = new Date(dayStart);
      startAt.setMinutes(meeting.startMinutes);
      const endAt = new Date(dayStart);
      endAt.setMinutes(meeting.endMinutes);
      return { startAt, endAt };
    });
};

export type { MeetingLike };

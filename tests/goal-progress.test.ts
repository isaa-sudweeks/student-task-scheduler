import { describe, expect, it } from 'vitest';
import { computeGoalProgress } from '@/lib/goal-progress';

describe('computeGoalProgress', () => {
  it('calculates deltas and flags behind goals', () => {
    const progress = computeGoalProgress(
      [
        {
          id: 'g1',
          type: 'SUBJECT',
          subject: 'Math',
          courseId: null,
          targetMinutes: 120,
          label: 'Math',
        },
        {
          id: 'g2',
          type: 'COURSE',
          subject: null,
          courseId: 'course-1',
          targetMinutes: 180,
          label: 'Physics 101',
        },
      ],
      {
        subjects: { Math: 90, English: 200 },
        courses: { 'course-1': 220 },
      },
    );

    expect(progress).toEqual([
      expect.objectContaining({
        id: 'g1',
        actualMinutes: 90,
        deltaMinutes: -30,
        remainingMinutes: 30,
        isBehind: true,
        progressPercent: 75,
      }),
      expect.objectContaining({
        id: 'g2',
        actualMinutes: 220,
        deltaMinutes: 40,
        remainingMinutes: 0,
        isBehind: false,
        progressPercent: 100,
      }),
    ]);
  });

  it('treats non-positive targets as fulfilled', () => {
    const progress = computeGoalProgress(
      [
        {
          id: 'g3',
          type: 'SUBJECT',
          subject: 'Art',
          courseId: null,
          targetMinutes: 0,
          label: 'Art',
        },
      ],
      {
        subjects: { Art: 15 },
      },
    );

    expect(progress[0]).toMatchObject({
      actualMinutes: 15,
      deltaMinutes: 15,
      remainingMinutes: 0,
      isBehind: false,
      progressPercent: 100,
    });
  });
});

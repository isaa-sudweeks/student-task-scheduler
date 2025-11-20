export type GoalType = 'SUBJECT' | 'COURSE';

export interface StudyGoalLike {
  id: string;
  type: GoalType;
  subject: string | null;
  courseId: string | null;
  targetMinutes: number;
  label?: string | null;
}

export interface GoalFocusTotals {
  subjects?: Record<string, number | undefined>;
  courses?: Record<string, number | undefined>;
}

export interface GoalProgress {
  id: string;
  type: GoalType;
  label: string;
  subject: string | null;
  courseId: string | null;
  targetMinutes: number;
  actualMinutes: number;
  deltaMinutes: number;
  remainingMinutes: number;
  isBehind: boolean;
  progressPercent: number;
}

const clampPercent = (value: number) => {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
};

export function computeGoalProgress(
  goals: StudyGoalLike[],
  totals: GoalFocusTotals,
): GoalProgress[] {
  const subjectTotals = totals.subjects ?? {};
  const courseTotals = totals.courses ?? {};

  return goals.map((goal) => {
    const label = goal.label ?? goal.subject ?? 'Goal';
    const target = Math.max(0, goal.targetMinutes);
    const actual = Math.round(
      goal.type === 'COURSE'
        ? courseTotals[goal.courseId ?? ''] ?? 0
        : subjectTotals[goal.subject ?? ''] ?? 0,
    );
    const delta = actual - target;
    const remaining = target <= 0 ? 0 : Math.max(target - actual, 0);
    const isBehind = target > 0 && actual < target;
    const percent = target <= 0 ? 100 : clampPercent((actual / target) * 100);

    return {
      id: goal.id,
      type: goal.type,
      label,
      subject: goal.subject ?? null,
      courseId: goal.courseId ?? null,
      targetMinutes: target,
      actualMinutes: actual,
      deltaMinutes: delta,
      remainingMinutes: remaining,
      isBehind,
      progressPercent: percent,
    } satisfies GoalProgress;
  });
}

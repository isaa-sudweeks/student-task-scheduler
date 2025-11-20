export interface GradeEntry {
  score: number;
  total: number;
  weight?: number | null;
}

export interface WeightedGradeResult {
  percentage: number | null;
  weightSum: number;
}

const gradeScale = [
  { min: 97, letter: 'A+', points: 4.0 },
  { min: 93, letter: 'A', points: 4.0 },
  { min: 90, letter: 'A-', points: 3.7 },
  { min: 87, letter: 'B+', points: 3.3 },
  { min: 83, letter: 'B', points: 3.0 },
  { min: 80, letter: 'B-', points: 2.7 },
  { min: 77, letter: 'C+', points: 2.3 },
  { min: 73, letter: 'C', points: 2.0 },
  { min: 70, letter: 'C-', points: 1.7 },
  { min: 67, letter: 'D+', points: 1.3 },
  { min: 63, letter: 'D', points: 1.0 },
  { min: 60, letter: 'D-', points: 0.7 },
  { min: 0, letter: 'F', points: 0 },
];

export function calculateWeightedPercentage(entries: GradeEntry[]): WeightedGradeResult {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const entry of entries) {
    if (!Number.isFinite(entry.score) || !Number.isFinite(entry.total)) continue;
    if (entry.total <= 0) continue;
    if (entry.score < 0) continue;

    const weight = entry.weight ?? entry.total;
    if (!Number.isFinite(weight) || weight <= 0) continue;

    const ratio = entry.score / entry.total;
    weightedSum += ratio * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return { percentage: null, weightSum: 0 };
  }

  return { percentage: (weightedSum / totalWeight) * 100, weightSum: totalWeight };
}

export interface LetterGradeResult {
  letter: string;
  points: number;
}

export function percentageToLetterGrade(value: number | null): LetterGradeResult | null {
  if (value == null || Number.isNaN(value)) return null;
  const clamped = Math.min(Math.max(value, 0), 100);
  const match = gradeScale.find((grade) => clamped >= grade.min);
  return match ? { letter: match.letter, points: match.points } : null;
}

export function percentageToGpa(value: number | null): number | null {
  const result = percentageToLetterGrade(value);
  return result ? result.points : null;
}

export { gradeScale };


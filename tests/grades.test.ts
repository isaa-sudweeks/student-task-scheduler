import { describe, expect, it } from 'vitest';

import {
  calculateWeightedPercentage,
  percentageToGpa,
  percentageToLetterGrade,
} from '@/lib/grades';

describe('grade helpers', () => {
  it('computes weighted percentages with explicit weights', () => {
    const { percentage, weightSum } = calculateWeightedPercentage([
      { score: 45, total: 50, weight: 40 },
      { score: 18, total: 20, weight: 60 },
    ]);

    expect(weightSum).toBe(100);
    expect(percentage).toBeCloseTo(90, 5);
  });

  it('falls back to total points for weights when none provided', () => {
    const { percentage, weightSum } = calculateWeightedPercentage([
      { score: 9, total: 10 },
      { score: 16, total: 20 },
    ]);

    expect(weightSum).toBe(30);
    expect(percentage).toBeCloseTo(((9 + 16) / 30) * 100, 5);
  });

  it('ignores invalid entries gracefully', () => {
    const { percentage, weightSum } = calculateWeightedPercentage([
      { score: 10, total: 0 },
      { score: -5, total: 20 },
      { score: 18, total: 20 },
    ]);

    expect(weightSum).toBe(20);
    expect(percentage).toBeCloseTo(90, 5);
  });

  it('derives GPA and letter grades from percentages', () => {
    expect(percentageToLetterGrade(95)).toEqual({ letter: 'A', points: 4 });
    expect(percentageToLetterGrade(88)).toEqual({ letter: 'B+', points: 3.3 });
    expect(percentageToLetterGrade(null)).toBeNull();

    expect(percentageToGpa(95)).toBe(4);
    expect(percentageToGpa(72)).toBe(1.7);
    expect(percentageToGpa(null)).toBeNull();
  });
});


import { describe, expect, it } from 'vitest';
import { parseAssignmentsFromText } from '@/server/syllabus/parser';

describe('parseAssignmentsFromText', () => {
  it('extracts dated assignments and normalises titles', () => {
    const now = new Date('2024-08-20T12:00:00Z');
    const text = `Course Schedule\nJanuary 15 - Essay 1 Draft Due\nFeb. 3: Lab Report 1\n3/10 Quiz on Chapters 5-6 at 11:30 am`;

    const assignments = parseAssignmentsFromText(text, { now });

    expect(assignments).toHaveLength(3);
    expect(assignments[0]).toMatchObject({
      title: 'Essay 1 Draft',
      dueAt: new Date('2025-01-15T17:00:00.000Z'),
    });
    expect(assignments[1]).toMatchObject({
      title: 'Lab Report 1',
      dueAt: new Date('2025-02-03T17:00:00.000Z'),
    });
    expect(assignments[2]).toMatchObject({
      title: 'Quiz on Chapters 5-6',
      dueAt: new Date('2025-03-10T11:30:00.000Z'),
    });
  });

  it('rolls dates into the next academic year when needed', () => {
    const now = new Date('2024-12-10T00:00:00Z');
    const text = 'Aug 25 Final Project Milestone';

    const [assignment] = parseAssignmentsFromText(text, { now });

    expect(assignment?.dueAt?.getUTCFullYear()).toBe(2025);
  });
});

import { describe, it, expect } from 'vitest';
import { statsToCSV } from './export';

describe('statsToCSV', () => {
  it('generates csv for stats', () => {
    const csv = statsToCSV({
      tasks: [
        { id: '1', title: 'Task 1', status: 'TODO', subject: 'Math' },
        { id: '2', title: 'Task 2', status: 'DONE', subject: 'Science' },
      ],
      statusData: [
        { status: 'TODO', count: 1 },
        { status: 'DONE', count: 1 },
      ],
      subjectData: [
        { subject: 'Math', count: 1 },
        { subject: 'Science', count: 1 },
      ],
      focusByTask: [
        { id: '1', title: 'Task 1', minutes: 30 },
      ],
    });
    expect(csv).toBe(
      [
        'id,title,status,subject',
        '1,Task 1,TODO,Math',
        '2,Task 2,DONE,Science',
        '',
        'status,count',
        'TODO,1',
        'DONE,1',
        '',
        'subject,count',
        'Math,1',
        'Science,1',
        '',
        'id,title,minutes',
        '1,Task 1,30',
      ].join('\n')
    );
  });

  it('escapes commas and quotes', () => {
    const csv = statsToCSV({
      tasks: [
        { id: '1', title: 'Task "A, B"', status: 'TODO', subject: 'Sci,ence' },
      ],
      statusData: [],
      subjectData: [],
      focusByTask: [],
    });
    expect(csv).toBe(
      [
        'id,title,status,subject',
        '1,"Task ""A, B""",TODO,"Sci,ence"',
        '',
        'status,count',
        '',
        'subject,count',
        '',
        'id,title,minutes',
      ].join('\n')
    );
  });
});


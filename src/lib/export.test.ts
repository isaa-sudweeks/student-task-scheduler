import { describe, it, expect, vi } from 'vitest';
import { statsToCSV, exportStatsToCSV } from './export';

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
      timeByTask: [
        {
          id: '1',
          title: 'Task 1',
          plannedMinutes: 45,
          actualMinutes: 30,
          deltaMinutes: -15,
        },
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
        'id,title,plannedMinutes,actualMinutes,deltaMinutes',
        '1,Task 1,45,30,-15',
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
      timeByTask: [],
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
        'id,title,plannedMinutes,actualMinutes,deltaMinutes',
      ].join('\n')
    );
  });
});

describe('exportStatsToCSV', () => {
  const sampleData = {
    tasks: [
      { id: '1', title: 'Task 1', status: 'TODO', subject: 'Math' },
    ],
    statusData: [{ status: 'TODO', count: 1 }],
    subjectData: [{ subject: 'Math', count: 1 }],
    timeByTask: [
      {
        id: '1',
        title: 'Task 1',
        plannedMinutes: 45,
        actualMinutes: 30,
        deltaMinutes: -15,
      },
    ],
  };

  it('triggers download when DOM is available', () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    const createSpy = vi.fn(() => 'blob:test');
    const revokeSpy = vi.fn();
    const originalCreate = (URL as any).createObjectURL;
    const originalRevoke = (URL as any).revokeObjectURL;
    (URL as any).createObjectURL = createSpy;
    (URL as any).revokeObjectURL = revokeSpy;

    const csv = exportStatsToCSV(sampleData, 'stats.csv');
    expect(csv).toBe(statsToCSV(sampleData));
    expect(clickSpy).toHaveBeenCalled();
    expect(createSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalled();

    clickSpy.mockRestore();
    (URL as any).createObjectURL = originalCreate;
    (URL as any).revokeObjectURL = originalRevoke;
  });

  it('returns csv string when DOM is unavailable', () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    // @ts-ignore force undefined for testing
    globalThis.window = undefined;
    // @ts-ignore force undefined for testing
    globalThis.document = undefined;

    const csv = exportStatsToCSV(sampleData, 'stats.csv');
    expect(csv).toBe(statsToCSV(sampleData));

    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  });
});


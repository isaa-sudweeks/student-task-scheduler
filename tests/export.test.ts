import { describe, expect, it, vi } from 'vitest';
import { exportStatsToCSV, statsToCSV, StatsExportData } from '@/lib/export';

describe('stats export helpers', () => {
  const sample: StatsExportData = {
    tasks: [
      { id: 't1', title: 'Essay', status: 'TODO', subject: 'English' } as any,
      { id: 't2', title: 'Quiz', status: 'DONE', subject: null } as any,
    ],
    statusData: [
      { status: 'TODO', count: 1 },
      { status: 'DONE', count: 1 },
    ],
    subjectData: [
      { subject: 'English', count: 1 },
      { subject: 'Math', count: 0 },
    ],
    timeByTask: [
      { id: 't1', title: 'Essay', plannedMinutes: 90, actualMinutes: 80, deltaMinutes: -10 },
    ],
  };

  it('serialises stats into a CSV string with section separators', () => {
    const csv = statsToCSV(sample);
    expect(csv.split('\n')[0]).toBe('id,title,status,subject');
    expect(csv).toContain('t1,Essay,TODO,English');
    expect(csv).toContain('status,count');
    expect(csv).toContain('subject,count');
    expect(csv).toContain('id,title,plannedMinutes,actualMinutes,deltaMinutes');
  });

  it('initiates a download when running in the browser', () => {
    const createObjectURL = vi.fn(() => 'blob:csv');
    const revoke = vi.fn();
    const originalCreate = (URL as any).createObjectURL;
    const originalRevoke = (URL as any).revokeObjectURL;
    (URL as any).createObjectURL = createObjectURL;
    (URL as any).revokeObjectURL = revoke;

    const click = vi.fn();
    const createElement = vi.spyOn(document, 'createElement').mockImplementation(() => ({
      href: '',
      download: '',
      click,
    }) as unknown as HTMLAnchorElement);

    try {
      const csv = exportStatsToCSV(sample, 'report.csv');
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(click).toHaveBeenCalledTimes(1);
      expect(revoke).toHaveBeenCalledWith('blob:csv');
      expect(csv).toContain('id,title,status,subject');
    } finally {
      createElement.mockRestore();
      if (originalCreate) {
        (URL as any).createObjectURL = originalCreate;
      } else {
        delete (URL as any).createObjectURL;
      }
      if (originalRevoke) {
        (URL as any).revokeObjectURL = originalRevoke;
      } else {
        delete (URL as any).revokeObjectURL;
      }
    }
  });
});

import type { RouterOutputs } from '@/server/api/root';

type Task = RouterOutputs['task']['list'][number];

export interface StatsExportData {
  tasks: Task[];
  statusData: { status: string; count: number }[];
  subjectData: { subject: string; count: number }[];
  focusByTask: { id: string; title: string; minutes: number }[];
}

function escapeValue(value: string | number): string {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function statsToCSV(data: StatsExportData): string {
  const lines: string[] = [
    'id,title,status,subject',
    ...data.tasks.map((t) =>
      [t.id, t.title, t.status, t.subject ?? ''].map(escapeValue).join(',')
    ),
    '',
    'status,count',
    ...data.statusData.map((s) =>
      [s.status, s.count].map(escapeValue).join(',')
    ),
    '',
    'subject,count',
    ...data.subjectData.map((s) =>
      [s.subject, s.count].map(escapeValue).join(',')
    ),
    '',
    'id,title,minutes',
    ...data.focusByTask.map((f) =>
      [f.id, f.title, f.minutes].map(escapeValue).join(',')
    ),
  ];
  return lines.join('\n');
}

export function exportStatsToCSV(
  data: StatsExportData,
  filename = 'stats.csv'
): string {
  const csv = statsToCSV(data);
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return csv;
  }
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return csv;
}


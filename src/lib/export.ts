import type { RouterOutputs } from '@/server/api/root';

type Task = RouterOutputs['task']['list'][number];

export interface StatsExportData {
  tasks: Task[];
  statusData: { status: string; count: number }[];
  subjectData: { subject: string; count: number }[];
  timeByTask: {
    id: string;
    title: string;
    plannedMinutes: number;
    actualMinutes: number;
    deltaMinutes: number;
  }[];
  courseGrades?: {
    courseId: string;
    title: string;
    gradeAverage: number | null;
    letter: string | null;
    creditHours: number | null;
    gradePoints: number | null;
    qualityPoints: number | null;
    gradedTaskCount: number;
  }[];
  gpa?: number;
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
    'id,title,plannedMinutes,actualMinutes,deltaMinutes',
    ...data.timeByTask.map((entry) =>
      [
        entry.id,
        entry.title,
        entry.plannedMinutes,
        entry.actualMinutes,
        entry.deltaMinutes,
      ]
        .map(escapeValue)
        .join(',')
    ),
  ];
  if (data.courseGrades) {
    lines.push('');
    lines.push(
      'courseId,title,gradeAverage,letter,creditHours,gradePoints,qualityPoints,gradedTaskCount'
    );
    for (const course of data.courseGrades) {
      lines.push(
        [
          course.courseId,
          course.title,
          course.gradeAverage ?? '',
          course.letter ?? '',
          course.creditHours ?? '',
          course.gradePoints ?? '',
          course.qualityPoints ?? '',
          course.gradedTaskCount,
        ]
          .map(escapeValue)
          .join(',')
      );
    }
    if (typeof data.gpa === 'number') {
      lines.push(
        ['OVERALL', 'GPA', '', '', '', data.gpa.toFixed(2), '', '']
          .map(escapeValue)
          .join(',')
      );
    }
  } else if (typeof data.gpa === 'number') {
    lines.push('');
    lines.push('metric,value');
    lines.push(
      ['overallGPA', data.gpa.toFixed(2)]
        .map(escapeValue)
        .join(',')
    );
  }
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


import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc';
import { db } from '@/server/db';
import { invalidateTaskListCache, requireUserId } from './utils';

const syllabusTaskInput = z.object({
  title: z.string().min(1).max(200),
  dueAt: z.date().nullable(),
  notes: z.string().max(2000).optional(),
});

export const taskSyllabusRouter = router({
  syllabusImport: protectedProcedure
    .input(
      z.object({
        courseId: z.string().min(1),
        tasks: z.array(syllabusTaskInput).min(1),
        now: z.date().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);
      const now = input.now ?? new Date();

      const normalizedTasks = input.tasks.map((task) => ({
        title: task.title.trim(),
        dueAt: task.dueAt ?? null,
        notes: task.notes?.trim() ? task.notes.trim() : null,
      }));

      const titleSet = Array.from(new Set(normalizedTasks.map((task) => task.title)));
      const existing = await db.task.findMany({
        where: {
          userId,
          courseId: input.courseId,
          title: { in: titleSet },
        },
        select: { id: true, title: true, dueAt: true },
      });

      const toKey = (task: { title: string; dueAt: Date | null }) =>
        `${task.title.toLowerCase()}|${task.dueAt ? task.dueAt.toISOString() : 'none'}`;

      const existingKeys = new Set(existing.map((task) => toKey({ title: task.title, dueAt: task.dueAt ?? null })));
      const seenKeys = new Set<string>();

      const created = [] as Awaited<ReturnType<typeof db.task.create>>[];
      const skipped: Array<{ reason: 'duplicate' | 'past-due'; task: typeof normalizedTasks[number] }> = [];

      for (const task of normalizedTasks) {
        const key = toKey(task);

        if (task.dueAt && task.dueAt.getTime() < now.getTime()) {
          skipped.push({ reason: 'past-due', task });
          continue;
        }

        if (existingKeys.has(key) || seenKeys.has(key)) {
          skipped.push({ reason: 'duplicate', task });
          continue;
        }

        seenKeys.add(key);

        const record = await db.task.create({
          data: {
            userId,
            courseId: input.courseId,
            title: task.title,
            dueAt: task.dueAt,
            notes: task.notes,
          },
        });
        created.push(record);
      }

      if (created.length > 0) {
        await invalidateTaskListCache(userId);
      }

      return {
        created,
        skipped,
      } as const;
    }),
});

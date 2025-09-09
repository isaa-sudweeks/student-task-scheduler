import { TRPCError } from '@trpc/server';
import { cache } from '@/server/cache';
import { db } from '@/server/db';

export const TASK_LIST_CACHE_PREFIX = 'task:list:';

const isPlainObject = (val: unknown): val is Record<string, unknown> =>
  Object.prototype.toString.call(val) === '[object Object]';

export const serializeSorted = (val: unknown): string => {
  const sort = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sort);
    if (isPlainObject(input)) {
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(input).sort()) {
        const value = (input as Record<string, unknown>)[key];
        if (value !== undefined) result[key] = sort(value);
      }
      return result;
    }
    return input;
  };
  return JSON.stringify(sort(val));
};

export const buildListCacheKey = (input: unknown, userId: string | null) =>
  `${TASK_LIST_CACHE_PREFIX}${userId ?? 'null'}:${serializeSorted(input ?? {})}`;

export const invalidateTaskListCache = (userId: string) =>
  cache.deleteByPrefix(`${TASK_LIST_CACHE_PREFIX}${userId}:`);

export const requireUserId = (ctx: { session?: { user?: { id?: string } | null } | null }) => {
  const id = ctx.session?.user?.id;
  if (!id) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return id;
};

export async function validateTaskRelationships(
  userId: string,
  ids: { projectId?: string | null; courseId?: string | null; parentId?: string | null },
) {
  const { projectId, courseId, parentId } = ids;
  if (typeof projectId === 'string') {
    const project = await db.project.findFirst({ where: { id: projectId, userId } });
    if (!project) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid projectId' });
  }
  if (typeof courseId === 'string') {
    const course = await db.course.findFirst({ where: { id: courseId, userId } });
    if (!course) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid courseId' });
  }
  if (typeof parentId === 'string') {
    const parent = await db.task.findFirst({ where: { id: parentId, userId } });
    if (!parent) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid parentId' });
  }
}

import { TRPCError } from '@trpc/server';
import { RecurrenceType, MemberRole } from '@prisma/client';
import { cache } from '@/server/cache';
import { assertCourseMember, assertProjectMember, assertTaskMember } from '@/server/api/permissions';

export const TASK_LIST_CACHE_PREFIX = 'task:list:';
export const TASK_SUBJECT_OPTIONS_CACHE_PREFIX = 'task:subjects:';

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

export const buildSubjectOptionsCacheKey = (userId: string) =>
  `${TASK_SUBJECT_OPTIONS_CACHE_PREFIX}${userId}`;

export const invalidateTaskListCache = (userId: string) => {
  cache.deleteByPrefix(`${TASK_LIST_CACHE_PREFIX}${userId}:`);
  cache.deleteByPrefix(buildSubjectOptionsCacheKey(userId));
};

export const requireUserId = (ctx: { session?: { user?: { id?: string } | null } | null }) => {
  const id = ctx.session?.user?.id;
  if (!id) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return id;
};

export const validateRecurrence = (input: {
  recurrenceType?: RecurrenceType | null;
  recurrenceInterval?: number;
  recurrenceCount?: number | null;
  recurrenceUntil?: Date | null;
}) => {
  if (input.recurrenceCount !== undefined && input.recurrenceUntil !== undefined) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Specify either recurrenceCount or recurrenceUntil, not both',
    });
  }
  if (
    input.recurrenceInterval !== undefined ||
    input.recurrenceCount !== undefined ||
    input.recurrenceUntil !== undefined
  ) {
    if (!input.recurrenceType || input.recurrenceType === RecurrenceType.NONE) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'recurrenceType must be provided and not NONE when specifying recurrence details',
      });
    }
  }
};

export async function validateTaskRelationships(
  userId: string,
  ids: { projectId?: string | null; courseId?: string | null; parentId?: string | null },
) {
  const { projectId, courseId, parentId } = ids;
  if (typeof projectId === 'string') {
    await assertProjectMember({ userId, projectId, roles: [MemberRole.OWNER, MemberRole.EDITOR] });
  }
  if (typeof courseId === 'string') {
    await assertCourseMember({ userId, courseId, roles: [MemberRole.OWNER, MemberRole.EDITOR] });
  }
  if (typeof parentId === 'string') {
    await assertTaskMember({ userId, taskId: parentId });
  }
}

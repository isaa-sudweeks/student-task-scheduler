import { TRPCError } from '@trpc/server';
import { cache } from '@/server/cache';

export const TASK_LIST_CACHE_PREFIX = 'task:list:';

export const buildListCacheKey = (input: unknown, userId: string | null) =>
  `${TASK_LIST_CACHE_PREFIX}${userId ?? 'null'}:${JSON.stringify(input ?? {})}`;

export const invalidateTaskListCache = () => cache.clear();

export const requireUserId = (ctx: { session?: { user?: { id?: string } | null } | null }) => {
  const id = ctx.session?.user?.id;
  if (!id) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return id;
};

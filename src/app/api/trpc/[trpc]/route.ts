import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/api/root';
import type { Context } from '@/server/api/trpc';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const handler = async (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: async (): Promise<Context> => {
      // Derive client IP for rate limiting and attach NextAuth session
      const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        null;
      const nextSession = await getServerSession(authOptions);
      const session: Context['session'] = nextSession?.user
        ? {
            user: {
              id: (nextSession.user as any).id as string | undefined,
              timezone: ((nextSession.user as any).timezone as string | null | undefined) ?? null,
            },
          }
        : null;
      return { ip, session };
    },
  });

export { handler as GET, handler as POST };

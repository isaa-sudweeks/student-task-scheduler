import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { getServerSession } from 'next-auth';
import { appRouter } from '@/server/api/root';
import { authOptions } from '@/server/auth';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: async () => ({
      session: await getServerSession(authOptions),
    }),
  });

export { handler as GET, handler as POST };

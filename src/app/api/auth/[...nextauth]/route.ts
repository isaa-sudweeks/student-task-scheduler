import NextAuth from 'next-auth';
import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { db } from '@/server/db';
import { env } from '@/env';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  secret: env.NEXTAUTH_SECRET,
  // Use JWT sessions so next-auth middleware can authenticate requests.
  // Database sessions are not readable in the edge middleware and cause login loops.
  session: { strategy: "jwt" },
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      // Allow linking Google to an existing user with the same email
      // This fixes OAuthAccountNotLinked when a user row already exists
      // (e.g., created before the Account row due to earlier schema errors).
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async session({ session }) {
      // Enrich session with user id and timezone for server routes
      if (session.user?.email) {
        try {
          const user = await db.user.findUnique({
            where: { email: session.user.email },
            select: { id: true, timezone: true },
          });
          (session.user as any).id = user?.id;
          (session.user as any).timezone = user?.timezone ?? null;
        } catch {
          // Best-effort enrichment; leave defaults if lookup fails
        }
      }
      return session;
    },
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      try {
        const safeUrl = new URL(url, baseUrl);
        // If NextAuth would send us to the site root, keep it at '/'
        if (safeUrl.origin === baseUrl && (safeUrl.pathname === "/" || safeUrl.pathname === "")) {
          return `${baseUrl}/`;
        }
        // Allow same-origin absolute or relative URLs
        if (safeUrl.origin === baseUrl) return safeUrl.toString();
        if (url.startsWith("/")) return `${baseUrl}${url}`;
      } catch (_) {
        // ignore parsing issues, fallthrough to default
      }
      // Fallback: land on the base page
      return `${baseUrl}/`;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

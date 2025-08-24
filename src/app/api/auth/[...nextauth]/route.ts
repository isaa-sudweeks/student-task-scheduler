import NextAuth from "next-auth";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { db } from "@/server/db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  secret: process.env.NEXTAUTH_SECRET,
  // Use JWT sessions so next-auth middleware can authenticate requests.
  // Database sessions are not readable in the edge middleware and cause login loops.
  session: { strategy: "jwt" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
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

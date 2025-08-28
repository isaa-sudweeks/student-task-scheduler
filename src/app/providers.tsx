"use client";

import React from "react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { Toaster } from "react-hot-toast";
import { SessionProvider, signIn } from "next-auth/react";
import { api } from "@/server/api/react";
import type { AppRouter } from "@/server/api/root";
import type { TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Avoid retry loops on UNAUTHORIZED; prompt sign-in once
            retry: (failureCount, error: any) => {
              if (error?.data?.code === "UNAUTHORIZED") return false;
              return failureCount < 2;
            },
          },
        },
      })
  );
  const [trpcClient] = React.useState(() =>
    api.createClient({
      links: [
        // Intercept UNAUTHORIZED errors and prompt re-auth
        ((() => {
          const authLink: TRPCLink<AppRouter> = () => ({ next, op }) => {
            return observable((observer) => {
              const unsub = next(op).subscribe({
                next(value) {
                  observer.next(value);
                },
                error(err: any) {
                  if (err?.data?.code === "UNAUTHORIZED") {
                    // Redirect to NextAuth sign-in and return to current page after login
                    if (typeof window !== "undefined") {
                      void signIn(undefined, { callbackUrl: window.location.href });
                    }
                  }
                  observer.error(err);
                },
                complete() {
                  observer.complete();
                },
              });
              return unsub;
            });
          };
          return authLink;
        })()),
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
          fetch: (url, opts) => fetch(url, { ...opts, credentials: "include" }),
        }),
      ],
    })
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SessionProvider>
        <api.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 3500,
                style: {
                  background: "#f3f4f6",
                  color: "#374151",
                },
                success: {
                  style: {
                    background: "#dcfce7",
                    color: "#166534",
                  },
                },
                error: {
                  style: {
                    background: "#fee2e2",
                    color: "#991b1b",
                  },
                },
              }}
            />
          </QueryClientProvider>
        </api.Provider>
      </SessionProvider>
    </ThemeProvider>
  );
}

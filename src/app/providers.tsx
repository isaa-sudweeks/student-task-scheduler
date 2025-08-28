"use client";

import React from "react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { Toaster } from "react-hot-toast";
import { SessionProvider } from "next-auth/react";
import { api } from "@/server/api/react";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient());
  const [trpcClient] = React.useState(() =>
    api.createClient({
      links: [
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

"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { api } from "@/server/api/react";
import { Toaster } from "react-hot-toast";
export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient());
  const [trpcClient] = React.useState(() =>
    api.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
          fetch: (url, opts) =>
            fetch(url, { ...opts, credentials: "include" }),
        }),
      ],
    })
  );
  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster />
      </QueryClientProvider>
    </api.Provider>
  );
}

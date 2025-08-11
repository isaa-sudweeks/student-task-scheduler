"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { api } from "@/server/api/react";
export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient());
  const [trpcClient] = React.useState(() =>
    api.createClient({
      transformer: superjson,
      links: [
        httpBatchLink({
          url: "/api/trpc",
          fetch: (url, opts) => fetch(url, { ...opts, credentials: "include" }),
        }),
      ],
    })
  );
  return (<api.Provider client={trpcClient} queryClient={queryClient}><QueryClientProvider client={queryClient}>{children}</QueryClientProvider></api.Provider>);
}

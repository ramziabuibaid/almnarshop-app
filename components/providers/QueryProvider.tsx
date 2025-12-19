'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

export function QueryProvider({ children }: { children: ReactNode }) {
  // Create a stable QueryClient instance
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Critical: Always refetch on window focus for multi-user sync
            refetchOnWindowFocus: true,
            // Retry failed requests once
            retry: 1,
            // Keep data in cache even when no components are using it
            gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
            // Note: staleTime is set per-query, not globally
          },
          mutations: {
            // Retry failed mutations once
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}


'use client';

import { useState } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';

import { createQueryClient } from '@/lib/query-client';

export function Providers({ children }: { children: React.ReactNode }) {
  // useState гарантирует уникальный экземпляр QueryClient для каждого пользователя
  const [queryClient] = useState(() => createQueryClient());

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <ReactQueryDevtools />
      </QueryClientProvider>
    </SessionProvider>
  );
}

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { Toaster } from 'sonner';

import { Providers } from '@/components/providers';

import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: 'Curio',
  description: 'Персональная читалка новостей',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
        <Toaster richColors />
      </body>
    </html>
  );
}

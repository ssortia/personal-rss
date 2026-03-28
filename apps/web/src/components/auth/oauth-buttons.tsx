'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { OAuthProvider } from '@/lib/oauth-providers';
import { cn } from '@/lib/utils';
import { signIn } from 'next-auth/react';

type Provider = OAuthProvider;

interface ProviderConfig {
  id: Provider;
  label: string;
  icon: React.ReactNode;
  /** Переопределяет классы кнопки (например, для брендовой кнопки Яндекса). */
  className?: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'google',
    label: 'Google',
    icon: (
      <svg viewBox="0 0 24 24" style={{ width: 24, height: 24, flexShrink: 0 }} aria-hidden="true">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
    ),
  },
  {
    id: 'github',
    label: 'Войти с GitHub',
    icon: (
      <svg
        viewBox="0 0 24 24"
        style={{ width: 26, height: 26, flexShrink: 0, fill: 'currentColor' }}
        aria-hidden="true"
      >
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
      </svg>
    ),
  },
  {
    id: 'yandex',
    label: 'Войти с Яндекс ID',
    className:
      'bg-black text-white hover:bg-neutral-900 hover:text-white border-black hover:border-neutral-900',
    icon: (
      <svg viewBox="0 0 32 32" style={{ width: 32, height: 32, flexShrink: 0 }} aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#FC3F1D" />
        <path
          d="M18.01 9.6h-1.04c-1.68 0-2.56.8-2.56 2.08 0 1.44.64 2.16 1.92 3.04l1.12.72-3.12 4.56H11.76l2.8-4.08c-1.6-1.12-2.48-2.24-2.48-4.08C12.08 9.2 13.52 8 16.56 8h3.12v12H18.01V9.6z"
          fill="#fff"
        />
      </svg>
    ),
  },
];

interface OAuthButtonsProps {
  enabledProviders: Provider[];
}

export function OAuthButtons({ enabledProviders }: OAuthButtonsProps) {
  const [loading, setLoading] = useState<Provider | null>(null);

  const visible = PROVIDERS.filter((p) => enabledProviders.includes(p.id));
  if (visible.length === 0) return null;

  async function handleSignIn(provider: Provider) {
    setLoading(provider);
    try {
      await signIn(provider, { callbackUrl: '/' });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="relative flex items-center">
        <div className="border-border flex-grow border-t" />
        <span className="text-muted-foreground mx-3 flex-shrink text-xs">или войдите через</span>
        <div className="border-border flex-grow border-t" />
      </div>
      <div className="flex flex-col gap-2">
        {visible.map((provider) => (
          <Button
            key={provider.id}
            type="button"
            variant="outline"
            size="lg"
            className={cn('h-14 w-full gap-3 text-base', provider.className)}
            disabled={loading !== null}
            onClick={() => handleSignIn(provider.id)}
          >
            {provider.icon}
            {loading === provider.id ? 'Перенаправление...' : provider.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

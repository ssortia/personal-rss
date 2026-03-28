'use client';

import { LogOut, Moon, Sun, User } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';

interface UserMenuProps {
  email: string;
  image?: string | null;
}

export function UserMenu({ email, image }: UserMenuProps) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  // Откладываем рендер иконки темы до монтирования — иначе hydration mismatch
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === 'dark';
  const initial = email[0]?.toUpperCase() ?? '?';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="ring-offset-background focus-visible:ring-ring flex h-9 w-9 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          aria-label="Меню пользователя"
        >
          {image ? (
            <Image
              src={image}
              alt={email}
              width={36}
              height={36}
              className="rounded-full object-cover"
            />
          ) : (
            <span className="bg-primary text-primary-foreground flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold">
              {initial}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="py-2 font-normal">
          <p className="truncate text-sm font-medium">{email}</p>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/profile">
            <User />
            Профиль
          </Link>
        </DropdownMenuItem>

        {/* onSelect preventDefault — не закрывает dropdown при клике на Switch */}
        {mounted && (
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="cursor-pointer"
          >
            {isDark ? <Moon /> : <Sun />}
            <span className="flex-1">Тёмная тема</span>
            <Switch
              checked={isDark}
              aria-label="Переключить тему"
              // Клик по Switch уже всплывёт до DropdownMenuItem, дублировать не нужно
              onClick={(e) => e.stopPropagation()}
              onCheckedChange={() => setTheme(isDark ? 'light' : 'dark')}
              className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4"
            />
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => void signOut({ callbackUrl: '/login' })}
          className="text-destructive focus:text-destructive cursor-pointer dark:text-red-400 dark:focus:text-red-400"
        >
          <LogOut />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

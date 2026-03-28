import Link from 'next/link';

import { APP_NAME } from '@repo/shared';

import { RoleProvider } from '@/components/auth/role-provider';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { MobileMenu } from '@/components/layout/mobile-menu';
import { NavLinks } from '@/components/layout/nav-links';
import { ThemeToggle } from '@/components/theme-toggle';
import { requireSession } from '@/lib/auth-guard';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  const isAdmin = session.user.role === 'ADMIN';

  const navItems = [
    { href: '/', label: 'Фид' },
    { href: '/sources', label: 'Источники' },
    { href: '/preferences', label: 'Интересы' },
    { href: '/profile', label: 'Профиль' },
    ...(isAdmin ? [{ href: '/admin/users', label: 'Пользователи' }] : []),
  ];

  return (
    <RoleProvider role={session.user.role}>
      <div className="bg-background min-h-screen">
        <header className="bg-card/80 sticky top-0 z-40 border-b backdrop-blur-sm">
          <div className="container mx-auto flex h-14 items-center justify-between px-4">
            {/* Лого + десктопная навигация */}
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2">
                <img src="/logo.svg" alt={APP_NAME} width={28} height={28} />
                <span className="text-primary text-lg font-bold tracking-tight">{APP_NAME}</span>
              </Link>
              {/* Десктопная навигация с подсветкой активного маршрута */}
              <nav className="desktop-nav">
                <NavLinks items={navItems} />
              </nav>
            </div>

            {/* Правая часть: тема, email, выход (десктоп) + бургер (мобиль) */}
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <div className="desktop-only">
                <span className="text-muted-foreground text-sm">{session.user?.email}</span>
                <SignOutButton className="text-muted-foreground hover:text-foreground text-sm transition-colors" />
              </div>
              <MobileMenu
                items={navItems}
                email={session.user?.email ?? ''}
                signOutButton={
                  <SignOutButton className="text-muted-foreground hover:text-foreground w-full px-4 py-2 text-left text-sm transition-colors" />
                }
              />
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">{children}</main>
      </div>
    </RoleProvider>
  );
}

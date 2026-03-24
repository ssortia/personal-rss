import Link from 'next/link';
import { redirect } from 'next/navigation';

import { RoleProvider } from '@/components/auth/role-provider';
import { MobileMenu } from '@/components/layout/mobile-menu';
import { ThemeToggle } from '@/components/theme-toggle';

import { auth, signOut } from '../../auth';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session || session.error === 'RefreshAccessTokenError') {
    redirect('/login');
  }

  const isAdmin = session.user.role === 'ADMIN';

  const navItems = [
    { href: '/', label: 'Фид' },
    { href: '/sources', label: 'Источники' },
    { href: '/preferences', label: 'Интересы' },
    ...(isAdmin ? [{ href: '/admin/users', label: 'Пользователи' }] : []),
  ];

  return (
    <RoleProvider role={session.user.role}>
      <div className="bg-background min-h-screen">
        <header className="bg-card/80 sticky top-0 z-40 border-b backdrop-blur-sm">
          <div className="container mx-auto flex h-14 items-center justify-between px-4">
            {/* Лого + десктопная навигация */}
            <div className="flex items-center gap-6">
              <Link href="/" className="text-primary text-lg font-bold tracking-tight">
                Curio
              </Link>
              {/* Десктопная навигация — серверный рендер, без hydration */}
              <nav className="desktop-nav">
                {navItems.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Правая часть: тема, email, выход (десктоп) + бургер (мобиль) */}
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <div className="desktop-only">
                <span className="text-muted-foreground text-sm">{session.user?.email}</span>
                <form
                  action={async () => {
                    'use server';
                    await signOut({ redirectTo: '/login' });
                  }}
                >
                  <button
                    type="submit"
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    Выйти
                  </button>
                </form>
              </div>
              <MobileMenu items={navItems} email={session.user?.email ?? ''} />
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">{children}</main>
      </div>
    </RoleProvider>
  );
}

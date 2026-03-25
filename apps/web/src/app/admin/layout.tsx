import Link from 'next/link';

import { RoleProvider } from '@/components/auth/role-provider';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { NavLinks } from '@/components/layout/nav-links';
import { ThemeToggle } from '@/components/theme-toggle';
import { requireAdminSession } from '@/lib/auth-guard';

const adminNavItems = [{ href: '/admin/users', label: 'Пользователи' }];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminSession();

  return (
    <RoleProvider role={session.user.role}>
      <div className="bg-background min-h-screen">
        <header className="bg-card/80 sticky top-0 z-40 border-b backdrop-blur-sm">
          <div className="container mx-auto flex h-14 items-center justify-between px-4">
            <div className="flex items-center gap-6">
              <Link href="/" className="text-primary text-lg font-bold tracking-tight">
                Curio
              </Link>
              <span className="text-muted-foreground text-sm">Админ</span>
              <nav className="flex items-center gap-6">
                <NavLinks items={adminNavItems} />
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <span className="text-muted-foreground desktop-inline text-sm">
                {session.user?.email}
              </span>
              <SignOutButton className="text-muted-foreground hover:text-foreground text-sm transition-colors" />
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">{children}</main>
      </div>
    </RoleProvider>
  );
}

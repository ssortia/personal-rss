'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
}

interface NavLinksProps {
  items: NavItem[];
}

export function NavLinks({ items }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <>
      {items.map(({ href, label }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={
              isActive
                ? 'text-foreground text-sm font-medium'
                : 'text-muted-foreground hover:text-foreground text-sm transition-colors'
            }
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}

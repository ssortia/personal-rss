'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

interface NavItem {
  href: string;
  label: string;
}

interface MobileMenuProps {
  items: NavItem[];
  email: string;
}

export function MobileMenu({ items, email }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="mobile-only relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-muted-foreground hover:text-foreground p-1 transition-colors"
        aria-label="Открыть меню"
      >
        {/* Иконка гамбургера / крестика */}
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          {open ? (
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          ) : (
            <path
              fillRule="evenodd"
              d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
              clipRule="evenodd"
            />
          )}
        </svg>
      </button>

      {open && (
        <>
          {/* Подложка для закрытия при клике вне меню */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="bg-card border-border absolute right-0 top-8 z-50 min-w-48 rounded-lg border py-2 shadow-lg">
            {items.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={[
                  'block px-4 py-2 text-sm transition-colors',
                  pathname === href
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                ].join(' ')}
              >
                {label}
              </Link>
            ))}
            <div className="border-border mx-4 my-2 border-t" />
            <p className="text-muted-foreground px-4 py-1 text-xs">{email}</p>
          </div>
        </>
      )}
    </div>
  );
}

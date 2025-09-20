'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { ShortcutsPopover } from './shortcuts-popover';
import ThemeToggle from './theme-toggle';
import { AccountMenu } from './account-menu';

interface NavItem {
  href: string;
  label: string;
}

const items: NavItem[] = [
  { href: '/', label: 'Tasks' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/projects', label: 'Projects' },
  { href: '/courses', label: 'Courses' },
  { href: '/stats', label: 'Stats' },
];

export default function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="relative z-40 border-b bg-white/80 backdrop-blur dark:bg-slate-950/80">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-12 items-center justify-between md:h-14">
          <div className="flex items-center gap-3">
            <button
              aria-label="Toggle navigation"
              className="p-2 md:hidden"
              onClick={() => setOpen((v) => !v)}
            >
              ☰
            </button>
            <div className="hidden gap-4 md:flex">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'px-3 py-2 text-sm border-b-2',
                    pathname === item.href
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-800'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ShortcutsPopover />
            <ThemeToggle />
            <Suspense fallback={<div aria-hidden className="h-9 w-9 rounded-full bg-black/10 dark:bg-white/10" />}>
              <AccountMenu />
            </Suspense>
          </div>
        </div>
        {open && (
          <div className="flex flex-col gap-2 pb-2 md:hidden">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'px-3 py-2 text-sm',
                  pathname === item.href
                    ? 'text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

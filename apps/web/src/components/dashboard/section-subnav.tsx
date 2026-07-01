'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export type SubnavTab = {
  label: string;
  href: string;
};

type SectionSubnavProps = {
  tabs: SubnavTab[];
  ariaLabel: string;
  className?: string;
};

export function SectionSubnav({ tabs, ariaLabel, className }: SectionSubnavProps) {
  const pathname = usePathname();

  if (tabs.length === 0) return null;

  return (
    <nav
      aria-label={ariaLabel}
      className={cn('mb-6 flex gap-1 overflow-x-auto border-b border-slate-200', className)}
    >
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

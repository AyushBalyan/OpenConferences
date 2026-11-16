'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function DashboardBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        // Narrow screens keep only the parent and the current page.
        const firstOnMobile = Math.max(0, items.length - 2);

        return (
          <span
            key={`${item.label}-${index}`}
            className={cn(
              'min-w-0 items-center gap-1',
              index < firstOnMobile ? 'hidden sm:flex' : 'flex',
            )}
          >
            {index > 0 ? (
              <ChevronRight
                className={cn(
                  'h-4 w-4 shrink-0 text-slate-400',
                  index === firstOnMobile ? 'hidden sm:block' : '',
                )}
                aria-hidden
              />
            ) : null}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="truncate text-slate-500 transition-colors hover:text-slate-900"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn('truncate', isLast ? 'font-medium text-slate-900' : 'text-slate-500')}
                aria-current={isLast ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

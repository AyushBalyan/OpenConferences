'use client';

import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  defaultSubTabHref,
  isNavItemActive,
  subTabHref,
  type NavItemConfig,
} from '@/lib/conference-nav';
import { cn } from '@/lib/utils';

type SidebarNavItemProps = {
  item: NavItemConfig;
  conferenceId: string;
  pathname: string;
  icon: LucideIcon;
};

export function SidebarNavItem({ item, conferenceId, pathname, icon: Icon }: SidebarNavItemProps) {
  const hasChildren = Boolean(item.children?.length);
  const active = isNavItemActive(item, conferenceId, pathname);
  const href = defaultSubTabHref(item, conferenceId);
  const base = item.href(conferenceId);

  if (!hasChildren) {
    return (
      <Link
        href={href}
        className={cn(
          'flex items-center gap-2.5 rounded-md border-l-2 px-3 py-2 text-sm font-medium transition-colors',
          active
            ? 'border-indigo-600 bg-indigo-50 font-semibold text-indigo-700'
            : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        )}
      >
        <Icon className="h-4 w-4 shrink-0 opacity-80" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  }

  return (
    <div className="space-y-0.5">
      <Link
        href={href}
        className={cn(
          'flex items-center gap-2.5 rounded-md border-l-2 px-3 py-2 text-sm font-medium transition-colors',
          active
            ? 'border-indigo-600 bg-indigo-50 font-semibold text-indigo-700'
            : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        )}
      >
        <Icon className="h-4 w-4 shrink-0 opacity-80" />
        <span className="flex-1 truncate">{item.label}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-slate-400 transition-transform',
            active ? 'rotate-180' : '',
          )}
          aria-hidden
        />
      </Link>

      {active ? (
        <div className="ml-3 space-y-0.5 border-l border-slate-200 pl-2">
          {item.children!.map((child) => {
            const childHref = subTabHref(base, child.segment);
            const childActive = pathname === childHref || pathname.startsWith(`${childHref}/`);

            return (
              <Link
                key={child.segment}
                href={childHref}
                className={cn(
                  'block rounded-md px-3 py-1.5 text-sm transition-colors',
                  childActive
                    ? 'bg-indigo-50 font-medium text-indigo-700'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

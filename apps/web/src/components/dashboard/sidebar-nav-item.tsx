'use client';

import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import {
  defaultSubTabHref,
  isNavItemActive,
  subTabHref,
  type NavItemConfig,
} from '@/lib/conference-nav';
import { useSidebarOptional } from '@/components/dashboard/sidebar-context';
import { cn } from '@/lib/utils';

type SidebarNavItemProps = {
  item: NavItemConfig;
  conferenceId: string;
  pathname: string;
  icon: LucideIcon;
};

export function SidebarNavItem({ item, conferenceId, pathname, icon: Icon }: SidebarNavItemProps) {
  const sidebar = useSidebarOptional();
  const collapsed = sidebar?.collapsed ?? false;
  const [flyoutOpen, setFlyoutOpen] = useState(false);

  const hasChildren = Boolean(item.children?.length);
  const active = isNavItemActive(item, conferenceId, pathname);
  const href = defaultSubTabHref(item, conferenceId);
  const base = item.href(conferenceId);

  const linkClass = (isActive: boolean, compact?: boolean) =>
    cn(
      'flex items-center rounded-md border-l-2 text-sm font-medium transition-colors',
      compact ? 'justify-center px-2 py-2' : 'gap-2.5 px-3 py-2',
      isActive
        ? 'border-indigo-600 bg-indigo-50 font-semibold text-indigo-700'
        : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    );

  if (!hasChildren) {
    return (
      <Link
        href={href}
        className={linkClass(active, collapsed)}
        title={collapsed ? item.label : undefined}
      >
        <Icon className="h-4 w-4 shrink-0 opacity-80" />
        {!collapsed ? <span className="truncate">{item.label}</span> : null}
      </Link>
    );
  }

  if (collapsed) {
    return (
      <div
        className="relative"
        onMouseEnter={() => setFlyoutOpen(true)}
        onMouseLeave={() => setFlyoutOpen(false)}
      >
        <Link
          href={href}
          className={linkClass(active, true)}
          title={item.label}
          aria-haspopup="true"
          aria-expanded={flyoutOpen}
        >
          <Icon className="h-4 w-4 shrink-0 opacity-80" />
        </Link>
        {flyoutOpen ? (
          <div className="absolute left-full top-0 z-50 ml-1 min-w-[200px] rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
              {item.label}
            </p>
            {item.children!.map((child) => {
              const childHref = subTabHref(base, child.segment);
              const childActive = pathname === childHref || pathname.startsWith(`${childHref}/`);
              return (
                <Link
                  key={child.segment}
                  href={childHref}
                  className={cn(
                    'block px-3 py-2 text-sm',
                    childActive
                      ? 'bg-indigo-50 font-medium text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-50',
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

  return (
    <div className="space-y-0.5">
      <Link href={href} className={linkClass(active)}>
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

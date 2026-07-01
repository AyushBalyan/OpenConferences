'use client';

import {
  ArrowLeft,
  ClipboardCheck,
  CreditCard,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Layers,
  ScrollText,
  Settings,
  ShieldAlert,
  UserCheck,
  Users,
  Vote,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navGroupsForRoles, roleLabels } from '@/lib/roles';
import { ConferenceSwitcher } from './conference-switcher';
import { SidebarNavItem } from './sidebar-nav-item';
import { SidebarUserSummary } from './user-menu';
import { StatusBadge } from './status-badge';
import { useConferenceWorkspace } from './conference-workspace';

const NAV_ICONS: Record<string, LucideIcon> = {
  Overview: LayoutDashboard,
  'My submissions': FileText,
  'All submissions': FileText,
  Bidding: Vote,
  'Bidding oversight': Vote,
  COI: ShieldAlert,
  'COI oversight': ShieldAlert,
  'My reviews': ClipboardCheck,
  'Review rounds': ClipboardCheck,
  Assignments: UserCheck,
  Decisions: ClipboardCheck,
  Settings: Settings,
  Tracks: Layers,
  Members: Users,
  'Audit log': ScrollText,
  Registrations: CreditCard,
};

export function ConferenceSidebar() {
  const pathname = usePathname();
  const { conferenceId, conference, conferences } = useConferenceWorkspace();
  const roles = conference?.myRoles ?? [];
  const groups = navGroupsForRoles(roles);
  const labels = roleLabels(roles);

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-4 border-b border-slate-200 p-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          All conferences
        </Link>

        {conference ? (
          <div className="space-y-2">
            <div>
              <p className="font-semibold leading-snug text-slate-900">{conference.name}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <StatusBadge status={conference.status} />
                {labels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
            {conferences.length > 1 ? (
              <ConferenceSwitcher conferences={conferences} currentId={conferenceId} />
            ) : null}
          </div>
        ) : null}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto p-4">
        {groups.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <SidebarNavItem
                  key={item.label}
                  item={item}
                  conferenceId={conferenceId}
                  pathname={pathname}
                  icon={NAV_ICONS[item.label] ?? FileText}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto space-y-3 border-t border-slate-200 p-4">
        <SidebarUserSummary />
        <Link
          href="mailto:support@openconferences.local"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <HelpCircle className="h-4 w-4" />
          Help & support
        </Link>
      </div>
    </div>
  );
}

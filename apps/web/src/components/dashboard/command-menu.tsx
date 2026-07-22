'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, LayoutDashboard, Search, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

import type { CommandNavItem } from '@/lib/conference-nav';
import { buildCommandItemsFromNav } from '@/lib/conference-nav';

type CommandMenuProps = {
  items: CommandNavItem[];
};

export function CommandMenuTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="hidden w-full max-w-md items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-700 md:flex"
    >
      <Search className="h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1 text-left">Search pages and actions…</span>
      <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 lg:inline">
        ⌘K
      </kbd>
    </button>
  );
}

export function CommandMenu({ items }: CommandMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const openMenu = useCallback(() => {
    setOpen(true);
    setQuery('');
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openMenu();
      }
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openMenu]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const haystack = [item.label, item.group, ...(item.keywords ?? [])].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, CommandNavItem[]>();
    for (const item of filtered) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return [...map.entries()];
  }, [filtered]);

  if (!open) {
    return <CommandMenuTrigger onOpen={openMenu} />;
  }

  return (
    <>
      <CommandMenuTrigger onOpen={openMenu} />
      <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 px-4 pt-[15vh]">
        <button
          type="button"
          aria-label="Close command menu"
          className="absolute inset-0"
          onClick={() => setOpen(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Command menu"
          className="relative w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search pages and actions…"
              className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="max-h-72 overflow-y-auto p-2">
            {grouped.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">No results found.</p>
            ) : (
              grouped.map(([group, groupItems]) => (
                <div key={group} className="mb-2 last:mb-0">
                  <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {group}
                  </p>
                  {groupItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-100',
                      )}
                      onClick={() => {
                        setOpen(false);
                        router.push(item.href);
                      }}
                    >
                      <CommandIcon label={item.label} />
                      {item.label}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
          <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
            Navigate with ↑↓ · Enter to open · Esc to close
          </div>
        </div>
      </div>
    </>
  );
}

function CommandIcon({ label }: { label: string }) {
  if (label.toLowerCase().includes('setting')) {
    return <Settings className="h-4 w-4 text-slate-400" />;
  }
  if (label.toLowerCase().includes('submission') || label.toLowerCase().includes('review')) {
    return <FileText className="h-4 w-4 text-slate-400" />;
  }
  return <LayoutDashboard className="h-4 w-4 text-slate-400" />;
}

/** @deprecated Use buildCommandItemsFromNav from conference-nav */
export function buildCommandItems(options: {
  conferenceId?: string;
  conferenceName?: string;
  roles?: string[];
}): CommandNavItem[] {
  return buildCommandItemsFromNav(options);
}

export type { CommandNavItem as CommandItem };

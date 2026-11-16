'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ComboboxOption = {
  value: string;
  label: string;
  /** Secondary text shown under the label and included in search. */
  hint?: string;
};

const MAX_RENDERED = 50;

/**
 * Searchable single-select. Use instead of a native select when the list can
 * grow past a screenful (papers, reviewers, members).
 */
export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder = 'Search…',
  emptyText = 'No matches',
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
}) {
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = options.find((option) => option.value === value);

  const matches = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return options;
    return options.filter((option) => {
      const haystack = `${option.label} ${option.hint ?? ''}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [options, query]);
  const visible = matches.slice(0, MAX_RENDERED);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) close();
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document
      .getElementById(`${listId}-option-${activeIndex}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open, listId]);

  function close() {
    setOpen(false);
    setQuery('');
  }

  function openList() {
    if (disabled) return;
    setOpen(true);
    setActiveIndex(
      Math.max(
        0,
        visible.findIndex((option) => option.value === value),
      ),
    );
  }

  function choose(option: ComboboxOption) {
    onChange(option.value);
    close();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      if (visible.length === 0) return;
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((index) => (index + delta + visible.length) % visible.length);
    } else if (event.key === 'Enter') {
      if (!open) return;
      event.preventDefault();
      const option = visible[activeIndex];
      if (option) choose(option);
    } else if (event.key === 'Escape') {
      if (!open) return;
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      close();
    }
  }

  return (
    <div ref={root} className="relative">
      <input
        ref={input}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && visible[activeIndex] ? `${listId}-option-${activeIndex}` : undefined
        }
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        placeholder={selected ? selected.label : placeholder}
        value={open ? query : (selected?.label ?? '')}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          if (!open) setOpen(true);
        }}
        onFocus={openList}
        onClick={() => {
          if (!open) openList();
        }}
        onKeyDown={onKeyDown}
        className="flex h-10 w-full truncate rounded-md border border-slate-200 bg-white py-2 pl-3 pr-16 text-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
      <div className="absolute inset-y-0 right-2 flex items-center gap-1">
        {selected && !disabled ? (
          <button
            type="button"
            aria-label="Clear selection"
            className="rounded p-1 text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => {
              onChange('');
              setQuery('');
              input.current?.focus();
            }}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
        <ChevronsUpDown className="pointer-events-none h-4 w-4 text-slate-400" aria-hidden />
      </div>
      <ul
        id={listId}
        role="listbox"
        hidden={!open}
        className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
      >
        {visible.map((option, index) => {
          const isSelected = option.value === value;
          return (
            <li
              key={option.value}
              id={`${listId}-option-${index}`}
              role="option"
              aria-selected={isSelected}
              data-value={option.value}
              // Keep focus in the input so the list does not close before the click lands.
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
              onMouseMove={() => setActiveIndex(index)}
              className={cn(
                'flex cursor-pointer items-start gap-2 px-3 py-2 text-sm',
                index === activeIndex ? 'bg-slate-100' : '',
              )}
            >
              <Check
                className={cn(
                  'mt-0.5 h-4 w-4 shrink-0 text-indigo-600',
                  isSelected ? 'opacity-100' : 'opacity-0',
                )}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block break-words text-slate-900">{option.label}</span>
                {option.hint ? (
                  <span className="block break-words text-xs text-slate-500">{option.hint}</span>
                ) : null}
              </span>
            </li>
          );
        })}
        {visible.length === 0 ? (
          <li role="presentation" className="px-3 py-2 text-sm text-slate-500">
            {emptyText}
          </li>
        ) : null}
        {matches.length > visible.length ? (
          <li role="presentation" className="px-3 py-2 text-xs text-slate-500">
            Showing {visible.length} of {matches.length}. Keep typing to narrow the list.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState, type ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type PasswordInputProps = Omit<ComponentProps<'input'>, 'type'>;

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-10',
          className,
        )}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 z-10 flex w-10 items-center justify-center rounded-r-md text-slate-500 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? (
          <EyeOff className="pointer-events-none h-4 w-4" aria-hidden />
        ) : (
          <Eye className="pointer-events-none h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type AuthShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  headingLevel?: 'h1' | 'h3';
};

export function AuthShell({
  title,
  description,
  children,
  footer,
  headingLevel = 'h3',
}: AuthShellProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-12">
      <Card className="w-full max-w-md border-slate-200 shadow-sm">
        <CardHeader>
          <div>
            {headingLevel === 'h1' ? (
              <h1 className="text-2xl font-semibold leading-tight tracking-tight text-slate-900">
                {title}
              </h1>
            ) : (
              <CardTitle className="text-2xl text-slate-900">{title}</CardTitle>
            )}
          </div>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
        {footer ? (
          <div className="border-t border-slate-100 px-6 py-4 text-sm text-slate-500">{footer}</div>
        ) : null}
      </Card>
    </div>
  );
}

export function AuthLink(props: React.ComponentProps<typeof Link>) {
  return (
    <Link
      className="font-medium text-indigo-600 underline-offset-4 hover:text-indigo-700 hover:underline"
      {...props}
    />
  );
}

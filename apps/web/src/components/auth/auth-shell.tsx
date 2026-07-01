'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type AuthShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-12">
      <Card className="w-full max-w-md border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-slate-900">{title}</CardTitle>
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

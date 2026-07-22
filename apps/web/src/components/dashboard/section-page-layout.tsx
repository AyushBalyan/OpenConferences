'use client';

import { PageHeader } from '@/components/dashboard/page-header';

type SectionPageLayoutProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
};

export function SectionPageLayout({
  title,
  description,
  actions,
  error,
  children,
}: SectionPageLayoutProps) {
  return (
    <>
      <PageHeader title={title} description={description} actions={actions} />
      {error ? (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}
      {children}
    </>
  );
}

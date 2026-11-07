import { notFound } from 'next/navigation';
import Link from 'next/link';
import { BarChart3, BookOpen, ArrowUpRight } from 'lucide-react';
import { AnalyticsOverview } from '@/components/dashboard/analytics-overview';
import { analyticsPreviewFixture } from './fixture';

export default function AnalyticsPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  const data = analyticsPreviewFixture();
  return (
    <div className="min-h-screen bg-[#f1f5f5] text-slate-900">
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <BookOpen className="h-5 w-5 text-teal-800" />
          FresiCMT
        </Link>
        <span className="text-xs text-slate-600">Local preview · Sample conference data</span>
      </header>
      <div className="flex gap-2 px-2 pb-2">
        <aside className="hidden w-56 shrink-0 px-4 pt-6 lg:block">
          <p className="text-xs text-slate-600">Conference workspace</p>
          <p className="mt-2 text-sm font-semibold">Systems &amp; Society 2026</p>
          <p className="mt-1 text-xs text-slate-600">Chair · Reviewing</p>
          <div className="mt-8 flex items-center gap-3 rounded-md bg-[#e3eaea] px-3 py-2.5 text-sm font-medium">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </div>
          <Link
            href={`/dashboard/conferences/${data.conferenceId}/analytics`}
            className="mt-8 inline-flex items-center gap-2 text-xs text-slate-600"
          >
            Open signed-in workspace
            <ArrowUpRight className="h-3 w-3" />
          </Link>
          <p className="mt-3 text-xs leading-5 text-slate-600">
            This preview uses the same analytics components as your conference workspace.
          </p>
        </aside>
        <main className="min-w-0 flex-1 rounded-2xl border border-[#e4eaea] bg-white px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-5">
              <p className="mb-3 text-xs text-slate-600">
                Systems &amp; Society 2026 / Conference insights
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
              <p className="mt-1 text-sm text-slate-600">
                Paper activity, review progress, and the next work to move forward.
              </p>
            </div>
            <AnalyticsOverview conferenceId={data.conferenceId} preview={data} />
          </div>
        </main>
      </div>
    </div>
  );
}

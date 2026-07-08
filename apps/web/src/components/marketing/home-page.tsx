'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ClipboardCheck, FileText, LayoutDashboard, Users } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const ROLES = [
  {
    title: 'Author',
    description:
      'Submit papers, track review progress, and complete registration for accepted work.',
    href: '/sign-in',
    cta: 'Sign in to submit',
    icon: FileText,
  },
  {
    title: 'Reviewer',
    description:
      'Accept invitations, declare conflicts of interest, and submit reviews on assigned papers.',
    href: '/sign-in',
    cta: 'Sign in as reviewer',
    icon: ClipboardCheck,
  },
  {
    title: 'Organizer',
    description:
      'Manage submissions, assignments, decisions, and registration for your conference.',
    href: '/sign-in',
    cta: 'Open dashboard',
    icon: LayoutDashboard,
  },
] as const;

const STEPS = [
  { label: 'Submit', detail: 'Authors upload papers and metadata' },
  { label: 'Review', detail: 'Reviewers score and comment on submissions' },
  { label: 'Decide', detail: 'Chairs record accept, reject, or revision outcomes' },
  { label: 'Register', detail: 'Accepted authors complete conference registration' },
] as const;

export function HomePage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && session) {
      router.replace('/me/dashboard');
    }
  }, [isPending, session, router]);

  if (isPending) {
    return (
      <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (session) {
    return null;
  }

  return (
    <main className="min-h-[calc(100dvh-3.5rem)]">
      <section className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-white via-slate-50 to-slate-100/80">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(79,70,229,0.12),transparent)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-5xl px-6 py-20 sm:py-28">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Academic conference platform
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl sm:leading-[1.1]">
            From submission to registration, in one place
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
            OpenConferences helps organizers run peer review, notify authors, collect camera-ready
            files, and manage registrations — without juggling spreadsheets and inboxes.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button asChild size="default" className="h-11 px-6 text-base">
              <Link href="/sign-up">
                Create account
                <ArrowRight className="ml-2 size-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="outline" size="default" className="h-11 px-6 text-base">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">I am an…</h2>
            <p className="mt-2 text-muted-foreground">
              Choose your role to get started. Reviewers with an email invitation can sign in with
              the invited address.
            </p>
          </div>
          <Users className="hidden size-8 text-indigo-200 sm:block" aria-hidden />
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {ROLES.map((role) => (
            <Card
              key={role.title}
              className="border-slate-200/80 shadow-sm transition-shadow hover:shadow-md"
            >
              <CardHeader className="pb-3">
                <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <role.icon className="size-5" aria-hidden />
                </div>
                <CardTitle className="text-lg">{role.title}</CardTitle>
                <CardDescription className="leading-relaxed">{role.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href={role.href}
                  className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  {role.cta}
                  <ArrowRight className="ml-1 size-3.5" aria-hidden />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200/80 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-900">
            How it works
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            A single workflow for every conference you run.
          </p>
          <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.label} className="relative text-center sm:text-left">
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{step.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="border-t border-slate-200/80 bg-slate-50">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} OpenConferences</p>
          <p>Built for academic conference organizers and participants.</p>
        </div>
      </footer>
    </main>
  );
}

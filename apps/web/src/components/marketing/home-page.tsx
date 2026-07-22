'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, ClipboardCheck, FilePenLine, Settings2 } from 'lucide-react';
import { useSession } from '@/lib/auth-client';

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
      <div className="oc-landing flex min-h-dvh items-center justify-center text-[var(--oc-on-surface-variant)]">
        Loading…
      </div>
    );
  }

  if (session) {
    return null;
  }

  return (
    <div className="oc-landing antialiased overflow-x-hidden">
      <nav className="fixed top-0 z-50 w-full border-b border-[var(--oc-surface-variant)] bg-[var(--oc-surface)]">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 md:px-16">
          <div className="oc-font-headline text-2xl font-bold text-[var(--oc-primary)] md:text-[32px] md:leading-10">
            OpenConferences
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <a
              className="oc-font-label text-xs font-medium tracking-wide text-[var(--oc-on-surface-variant)] transition-colors hover:text-[var(--oc-primary-dim)]"
              href="#capabilities"
            >
              Features
            </a>
            <a
              className="oc-font-label text-xs font-medium tracking-wide text-[var(--oc-on-surface-variant)] transition-colors hover:text-[var(--oc-primary-dim)]"
              href="#roles"
            >
              Roles
            </a>
            <a
              className="oc-font-label text-xs font-medium tracking-wide text-[var(--oc-on-surface-variant)] transition-colors hover:text-[var(--oc-primary-dim)]"
              href="#cta"
            >
              Pricing
            </a>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/sign-in"
              className="oc-font-label text-xs font-medium tracking-wide text-[var(--oc-on-surface-variant)] transition-colors hover:text-[var(--oc-primary-dim)]"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="oc-font-label rounded-sm bg-[var(--oc-primary)] px-4 py-2 text-xs font-medium tracking-wide text-white shadow-sm transition-colors hover:bg-[var(--oc-primary-dim)]"
            >
              Create account
            </Link>
          </div>
        </div>
      </nav>

      <header className="relative flex min-h-[min(921px,100dvh)] flex-col justify-center bg-paper-grain hero-gradient px-4 pb-20 pt-40 md:px-16">
        <div className="relative z-10 mx-auto max-w-4xl space-y-6 text-center">
          <h1 className="oc-font-display mb-2 text-4xl font-bold leading-tight tracking-tight text-[var(--oc-primary)] sm:text-5xl md:text-[57px] md:leading-[64px]">
            OpenConferences
          </h1>
          <h2 className="oc-font-headline mb-6 text-2xl font-semibold text-[var(--oc-on-surface)] md:text-[32px] md:leading-10">
            From submission to registration, in one place.
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-[var(--oc-on-surface-variant)]">
            Run peer review, notify authors, collect camera-ready files, and manage registrations —
            without juggling spreadsheets and inboxes. A scholarly platform built for precision.
          </p>
          <div className="flex flex-col items-center justify-center gap-2 pt-6 sm:flex-row sm:gap-3">
            <Link
              href="/sign-up"
              className="oc-font-label w-full rounded-sm bg-[var(--oc-primary)] px-8 py-3 text-center text-xs font-medium tracking-wide text-white shadow-sm transition-colors hover:bg-[var(--oc-primary-dim)] sm:w-auto"
            >
              Create account
            </Link>
            <Link
              href="/sign-in"
              className="oc-font-label w-full rounded-sm border border-[var(--oc-outline)] px-8 py-3 text-center text-xs font-medium tracking-wide text-[var(--oc-secondary)] transition-colors hover:bg-[var(--oc-surface-container)] hover:text-[var(--oc-on-surface)] sm:w-auto"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <section
        id="roles"
        className="scroll-mt-24 border-y border-[var(--oc-surface-variant)] bg-[var(--oc-surface-container-lowest)] px-4 py-20 md:px-16"
      >
        <div className="mx-auto max-w-7xl">
          <h3 className="oc-font-headline mb-16 text-center text-[28px] font-semibold leading-9 text-[var(--oc-on-surface)]">
            I am an...
          </h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="flex flex-col items-start rounded-sm border border-[var(--oc-surface-variant)] bg-[var(--oc-surface)] p-8 transition-shadow hover:shadow-sm">
              <FilePenLine className="mb-6 size-10 text-[var(--oc-primary)]" aria-hidden />
              <h4 className="oc-font-headline mb-4 text-xl font-semibold text-[var(--oc-on-surface)]">
                Author
              </h4>
              <p className="mb-8 flex-grow text-base leading-6 text-[var(--oc-on-surface-variant)]">
                Submit papers seamlessly, track review progress transparently, upload camera-ready
                versions, and handle your conference registration.
              </p>
              <Link
                href="/sign-in"
                className="oc-font-label mt-auto inline-flex items-center gap-2 text-xs font-medium tracking-wide text-[var(--oc-primary)] transition-colors hover:text-[var(--oc-primary-dim)]"
              >
                Sign in to submit
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            <div className="flex flex-col items-start rounded-sm border border-[var(--oc-surface-variant)] bg-[var(--oc-surface)] p-8 transition-shadow hover:shadow-sm">
              <ClipboardCheck className="mb-6 size-10 text-[var(--oc-primary)]" aria-hidden />
              <h4 className="oc-font-headline mb-4 text-xl font-semibold text-[var(--oc-on-surface)]">
                Reviewer
              </h4>
              <p className="mb-8 flex-grow text-base leading-6 text-[var(--oc-on-surface-variant)]">
                Accept invitations securely, declare conflicts of interest upfront, access assigned
                papers, and submit structured reviews.
              </p>
              <Link
                href="/sign-in"
                className="oc-font-label mt-auto inline-flex items-center gap-2 text-xs font-medium tracking-wide text-[var(--oc-primary)] transition-colors hover:text-[var(--oc-primary-dim)]"
              >
                Sign in as reviewer
                <ArrowRight className="size-3.5" />
              </Link>
            </div>

            <div className="flex flex-col items-start rounded-sm border border-[var(--oc-surface-variant)] bg-[var(--oc-surface)] p-8 transition-shadow hover:shadow-sm">
              <Settings2 className="mb-6 size-10 text-[var(--oc-primary)]" aria-hidden />
              <h4 className="oc-font-headline mb-4 text-xl font-semibold text-[var(--oc-on-surface)]">
                Organizer
              </h4>
              <p className="mb-8 flex-grow text-base leading-6 text-[var(--oc-on-surface-variant)]">
                Manage call for papers, assign reviewers, record decisions, notify participants, and
                oversee the entire registration pipeline.
              </p>
              <Link
                href="/sign-in"
                className="oc-font-label mt-auto inline-flex items-center gap-2 text-xs font-medium tracking-wide text-[var(--oc-primary)] transition-colors hover:text-[var(--oc-primary-dim)]"
              >
                Open dashboard
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="lifecycle" className="scroll-mt-24 bg-[var(--oc-surface)] px-4 py-20 md:px-16">
        <div className="mx-auto max-w-7xl">
          <h3 className="oc-font-headline mb-20 text-center text-[28px] font-semibold leading-9 text-[var(--oc-on-surface)]">
            The Conference Lifecycle
          </h3>
          <div className="relative">
            <div className="absolute left-[10%] right-[10%] top-6 hidden h-px bg-[var(--oc-outline-variant)] md:block" />
            <div className="relative z-10 grid grid-cols-1 gap-6 md:grid-cols-4">
              {[
                {
                  n: '1',
                  title: 'Submit',
                  detail: 'Authors upload manuscripts and metadata through a clean interface.',
                },
                {
                  n: '2',
                  title: 'Review',
                  detail: 'Program committee assigns papers. Reviewers evaluate and score.',
                },
                {
                  n: '3',
                  title: 'Decide',
                  detail: 'Chairs finalize acceptance. Automated batch notifications are sent.',
                },
                {
                  n: '4',
                  title: 'Register',
                  detail: 'Attendees secure their spots and manage travel requirements.',
                },
              ].map((step) => (
                <div key={step.n} className="flex flex-col items-center text-center">
                  <div className="oc-font-headline mb-6 flex size-12 items-center justify-center rounded-full border-2 border-[var(--oc-surface)] bg-[var(--oc-surface-container-high)] text-[var(--oc-primary)] shadow-sm">
                    {step.n}
                  </div>
                  <h4 className="oc-font-headline mb-2 text-lg font-semibold text-[var(--oc-on-surface)]">
                    {step.title}
                  </h4>
                  <p className="px-4 text-sm leading-6 text-[var(--oc-on-surface-variant)]">
                    {step.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="capabilities"
        className="scroll-mt-24 border-y border-[var(--oc-surface-variant)] bg-[var(--oc-surface-container-lowest)] px-4 py-20 md:px-16"
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-16 md:grid-cols-3">
            <CapabilityColumn
              title="Peer review & COI"
              items={[
                'Double-blind or single-blind configurations.',
                'Automated conflict of interest detection.',
                'Customizable review forms and scoring rubrics.',
              ]}
            />
            <CapabilityColumn
              title="Decisions & notifications"
              items={[
                'Bulk email capabilities with mail merge fields.',
                'Audit trails for decision changes.',
                'Camera-ready deadline enforcement.',
              ]}
            />
            <CapabilityColumn
              title="Registration & roles"
              items={[
                'Tiered pricing (early bird, student, regular).',
                'Secure payment gateway integrations.',
                'Granular access control for PC members.',
              ]}
            />
          </div>
        </div>
      </section>

      <section
        id="cta"
        className="scroll-mt-24 bg-[var(--oc-surface-container)] px-4 py-20 text-center md:px-16"
      >
        <div className="mx-auto max-w-3xl space-y-8">
          <h2 className="oc-font-headline text-[32px] font-semibold leading-10 text-[var(--oc-primary)]">
            Ready to run your next conference?
          </h2>
          <p className="text-lg leading-7 text-[var(--oc-on-surface-variant)]">
            Join thousands of academic organizers relying on OpenConferences for a seamless,
            professional experience.
          </p>
          <Link
            href="/sign-up"
            className="oc-font-label mt-4 inline-block rounded-sm bg-[var(--oc-primary)] px-10 py-4 text-xs font-medium tracking-wide text-white shadow-sm transition-colors hover:bg-[var(--oc-primary-dim)]"
          >
            Create account
          </Link>
        </div>
      </section>

      <footer className="w-full bg-[var(--oc-surface-container-low)] px-4 py-20 md:px-16">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 md:flex-row">
          <div className="flex flex-col items-center gap-4 md:items-start">
            <div className="oc-font-headline text-[28px] font-semibold text-[var(--oc-primary)]">
              OpenConferences
            </div>
            <p className="text-center text-sm text-[var(--oc-secondary)] md:text-left">
              Built for academic conference organizers and participants.
            </p>
            <p className="text-center text-sm text-[var(--oc-secondary)] md:text-left">
              © 2026 OpenConferences.
            </p>
          </div>
          <div className="oc-font-label flex flex-col items-center gap-6 text-xs font-medium tracking-wide md:flex-row md:gap-8">
            <a
              className="text-[var(--oc-on-surface-variant)] opacity-80 transition-colors hover:text-[var(--oc-primary)] hover:opacity-100"
              href="#"
            >
              Privacy Policy
            </a>
            <a
              className="text-[var(--oc-on-surface-variant)] opacity-80 transition-colors hover:text-[var(--oc-primary)] hover:opacity-100"
              href="#"
            >
              Terms of Service
            </a>
            <a
              className="text-[var(--oc-on-surface-variant)] opacity-80 transition-colors hover:text-[var(--oc-primary)] hover:opacity-100"
              href="#"
            >
              Contact Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CapabilityColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="oc-font-headline mb-6 border-b border-[var(--oc-surface-variant)] pb-4 text-[28px] font-semibold leading-9 text-[var(--oc-on-surface)]">
        {title}
      </h4>
      <ul className="space-y-4 text-base leading-6 text-[var(--oc-on-surface-variant)]">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <Check className="mt-0.5 size-5 shrink-0 text-[var(--oc-primary)]" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

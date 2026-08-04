'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  FileCheck2,
  Fingerprint,
  ScanSearch,
  ShieldCheck,
} from 'lucide-react';
import { useSession } from '@/lib/auth-client';

const lifecycle = [
  {
    number: '01',
    title: 'Submit',
    detail: 'Collect manuscripts, authorship, and metadata in one structured intake.',
  },
  {
    number: '02',
    title: 'Review',
    detail: 'Coordinate invitations, bids, conflicts, assignments, and review rounds.',
  },
  {
    number: '03',
    title: 'Decide',
    detail: 'Record outcomes and move each paper into its correct next step.',
  },
  {
    number: '04A',
    title: 'Camera-ready',
    detail: 'After acceptance, collect final versions through the controlled paper workflow.',
  },
  {
    number: '04B',
    title: 'Register',
    detail: 'In parallel, connect accepted papers with registration and verification.',
  },
];

const roleRows = [
  {
    label: 'Paper intake',
    organizer: 'Configure & monitor',
    author: 'Submit',
    reviewer: '—',
  },
  {
    label: 'Peer review',
    organizer: 'Assign & coordinate',
    author: 'Track',
    reviewer: 'Review',
  },
  {
    label: 'Conflict safeguards',
    organizer: 'Oversee',
    author: 'Authorship scoped',
    reviewer: 'Declare',
  },
  {
    label: 'Finalization',
    organizer: 'Control windows',
    author: 'Upload & register',
    reviewer: '—',
  },
];

const papers = [
  { id: 'FC-1042', title: 'Adaptive Systems for…', review: '3 / 3', decision: 'Accept' },
  { id: 'FC-1043', title: 'A Framework for…', review: '2 / 3', decision: 'Pending' },
  { id: 'FC-1044', title: 'Evaluating Distributed…', review: '3 / 3', decision: 'Revision' },
];

export function HomePage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && session) {
      router.replace('/me/dashboard');
    }
  }, [isPending, session, router]);

  if (session) {
    return null;
  }

  return (
    <div className="fc-landing overflow-x-hidden">
      {/* THESIS: The conference lifecycle is the page—not a row of generic feature cards.
          OWN-WORLD: Mineral paper, ink rules, blue control fields, chartreuse status signals.
          STORY: Organizers see the whole workflow, its participants, and its safeguards before acting.
          FIRST VIEWPORT: Editorial headline at left; operational conference ledger at right; CTA in-line.
          FORM: Conference control sheet, lifecycle-led composition, generated in Stitch with Gemini 3.1 Pro. */}
      <nav className="fc-nav" aria-label="Primary navigation">
        <div className="fc-shell flex h-16 items-center justify-between">
          <a href="#" className="fc-wordmark" aria-label="FresiCMT home">
            Fresi<span>CMT</span>
          </a>
          <div className="hidden items-center gap-7 md:flex">
            <a className="fc-nav-link" href="#workflow">
              Workflow
            </a>
            <a className="fc-nav-link" href="#roles">
              Roles
            </a>
            <a className="fc-nav-link" href="#capabilities">
              Capabilities
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="fc-text-link hidden sm:inline-flex">
              Sign in
            </Link>
            <Link href="/sign-up" className="fc-button fc-button-ink">
              Create account
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <header className="fc-grid-paper border-b border-[var(--fc-ink)]">
          <div className="fc-shell grid min-h-[calc(100dvh-4rem)] items-center gap-14 py-20 lg:grid-cols-[0.8fr_1.2fr] lg:py-28">
            <div className="max-w-xl">
              <div className="fc-status-stamp mb-8">
                <span className="fc-signal-dot" />
                Conference management, end to end
              </div>
              <h1 className="fc-display text-balance">
                One conference.
                <br />
                One continuous
                <br />
                <span className="text-[var(--fc-blue)]">workflow.</span>
              </h1>
              <p className="mt-7 max-w-[58ch] text-lg leading-8 text-[var(--fc-muted)]">
                Run submissions, peer review, decisions, camera-ready collection, and registration
                without stitching together spreadsheets and inboxes.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/sign-up" className="fc-button fc-button-blue">
                  Create account
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link href="/sign-in" className="fc-button fc-button-outline">
                  Sign in
                </Link>
              </div>
            </div>

            <ConferenceLedger />
          </div>
        </header>

        <section id="workflow" className="fc-section scroll-mt-20 border-b border-[var(--fc-ink)]">
          <div className="fc-shell">
            <div className="fc-section-heading">
              <div>
                <span className="fc-data-label">Lifecycle control</span>
                <h2>A clear handoff—then two parallel finalization tracks.</h2>
              </div>
              <p>
                The paper remains the shared thread through decisions; after acceptance,
                camera-ready collection and registration can progress side by side.
              </p>
            </div>
            <ol className="fc-lifecycle">
              {lifecycle.map((stage, index) => (
                <li key={stage.number} className="fc-stage">
                  <div className="fc-stage-rail" aria-hidden>
                    <span>{stage.number}</span>
                    <div className={index < lifecycle.length - 1 ? 'fc-stage-line' : ''} />
                  </div>
                  <h3>{stage.title}</h3>
                  <p>{stage.detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="roles" className="fc-section scroll-mt-20 bg-white">
          <div className="fc-shell grid gap-12 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <span className="fc-data-label">Role-aware by design</span>
              <h2 className="fc-section-title mt-4">
                One system. A precise view for every participant.
              </h2>
              <p className="mt-6 max-w-[52ch] text-lg leading-8 text-[var(--fc-muted)]">
                Organizers coordinate the full program while authors and reviewers see the work that
                belongs to them—within the same conference context.
              </p>
              <Link href="/sign-in" className="fc-inline-action mt-8">
                Open your workspace <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>

            <div className="fc-role-matrix" role="table" aria-label="Role responsibilities">
              <div className="fc-role-row fc-role-head" role="row">
                <div role="columnheader">Workflow</div>
                <div role="columnheader">Organizer · control</div>
                <div role="columnheader">Author</div>
                <div role="columnheader">Reviewer</div>
              </div>
              {roleRows.map((row) => (
                <div className="fc-role-row" role="row" key={row.label}>
                  <div role="cell">{row.label}</div>
                  <div role="cell" className="fc-organizer-cell">
                    <Check className="size-4" aria-hidden />
                    {row.organizer}
                  </div>
                  <div role="cell">{row.author}</div>
                  <div role="cell">{row.reviewer}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="capabilities"
          className="fc-section scroll-mt-20 border-y border-[var(--fc-ink)]"
        >
          <div className="fc-shell">
            <div className="fc-section-heading">
              <div>
                <span className="fc-data-label">Mechanisms, not promises</span>
                <h2>Built around the work organizers inspect.</h2>
              </div>
              <p>Every capability is connected to a visible state, participant, and next action.</p>
            </div>
            <div className="fc-evidence-grid">
              <CapabilityEvidence
                icon={<ScanSearch className="size-5" />}
                title="Peer review & COI"
                description="Coordinate invitations, bidding, declarations, assignments, and blinded review from one round."
              >
                <div className="fc-assignment">
                  <span className="fc-data-label">Assignment check</span>
                  <div className="mt-4 flex items-center justify-between gap-4">
                    <div>
                      <strong>FC-1043</strong>
                      <p>Reviewer 07</p>
                    </div>
                    <span className="fc-chip fc-chip-ok">
                      <ShieldCheck className="size-3.5" /> No declared COI
                    </span>
                  </div>
                </div>
              </CapabilityEvidence>
              <CapabilityEvidence
                icon={<FileCheck2 className="size-5" />}
                title="Decisions & notifications"
                description="Record outcomes against the correct paper and round, then keep author communication connected."
              >
                <div className="fc-decision-strip">
                  {['Accept', 'Revision', 'Pending'].map((item, index) => (
                    <div key={item}>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <strong>{item}</strong>
                    </div>
                  ))}
                </div>
              </CapabilityEvidence>
              <CapabilityEvidence
                icon={<Fingerprint className="size-5" />}
                title="Registration & roles"
                description="Carry accepted work forward while conference-scoped roles keep access and responsibilities explicit."
              >
                <div className="space-y-3">
                  {[
                    ['A. Rao', 'Author', 'Verified'],
                    ['M. Singh', 'Organizer', 'Active'],
                  ].map(([name, role, state]) => (
                    <div className="fc-person-row" key={name}>
                      <strong>{name}</strong>
                      <span>{role}</span>
                      <span className="fc-chip fc-chip-ok">{state}</span>
                    </div>
                  ))}
                </div>
              </CapabilityEvidence>
            </div>
          </div>
        </section>

        <section className="fc-control-section">
          <div className="fc-shell grid gap-12 py-20 lg:grid-cols-[1fr_1.25fr] lg:py-28">
            <div>
              <span className="fc-data-label fc-data-label-light">Visible controls</span>
              <h2 className="fc-section-title mt-4 text-white">
                Trust is easier when the rules are visible.
              </h2>
              <p className="mt-6 max-w-[52ch] text-lg leading-8 text-zinc-300">
                FresiCMT puts conference boundaries, review settings, and decision history where
                organizers can see and manage them.
              </p>
            </div>
            <div className="fc-control-ledger">
              {[
                ['Conference-scoped access', 'Roles stay attached to the correct conference.'],
                [
                  'Blinding configuration',
                  'Open, single-, and double-blind modes shape visible data.',
                ],
                ['Conflict safeguards', 'Declarations remain part of reviewer coordination.'],
                ['Auditable changes', 'Sensitive workflow actions retain a visible trail.'],
              ].map(([title, description]) => (
                <div key={title}>
                  <CheckCircle2 className="size-5 text-[var(--fc-lime)]" aria-hidden />
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="cta" className="fc-cta border-b border-[var(--fc-ink)]">
          <div className="fc-shell py-20 lg:py-28">
            <span className="fc-data-label">Your next conference</span>
            <div className="mt-5 flex flex-col justify-between gap-10 lg:flex-row lg:items-end">
              <h2>Run the whole conference in one place.</h2>
              <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                <Link href="/sign-up" className="fc-button fc-button-ink">
                  Create account <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link href="/sign-in" className="fc-button fc-button-outline">
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white">
        <div className="fc-shell grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="fc-wordmark">
              Fresi<span>CMT</span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--fc-muted)]">
              Conference management from submission through registration.
            </p>
          </div>
          <div className="fc-footer-links">
            <strong>Product</strong>
            <a href="#workflow">Workflow</a>
            <a href="#roles">Roles</a>
            <a href="#capabilities">Capabilities</a>
          </div>
          <div className="fc-footer-links">
            <strong>Connect</strong>
            <Link href="/sign-in">Sign in</Link>
            <Link href="/sign-up">Create account</Link>
            <a href="mailto:contact@fresi.org">Contact support</a>
          </div>
        </div>
        <div className="fc-shell flex flex-col gap-2 border-t border-zinc-200 py-5 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 FresiCMT</span>
          <span>Built for academic conference organizers and participants.</span>
        </div>
      </footer>
    </div>
  );
}

function ConferenceLedger() {
  return (
    <div className="fc-ledger">
      <div className="fc-ledger-bar">
        <span>Illustrative conference workspace</span>
        <span>FC · DEMO 2026</span>
      </div>
      <div className="fc-ledger-summary">
        <div>
          <span>Conference</span>
          <strong>Future Computing 2026</strong>
        </div>
        <div>
          <span>Current phase</span>
          <strong className="text-[var(--fc-blue)]">Decisions</strong>
        </div>
        <div>
          <span>Next handoff</span>
          <strong>Camera-ready · 14d</strong>
        </div>
      </div>
      <div className="fc-ledger-flow" aria-label="Conference lifecycle progress">
        {['Submit', 'Review', 'Decide', 'Camera', 'Register'].map((stage, index) => (
          <div key={stage} className={index < 2 ? 'is-complete' : index === 2 ? 'is-active' : ''}>
            {index < 2 ? <Check className="size-3" /> : <Circle className="size-3" />}
            <span>{stage}</span>
          </div>
        ))}
      </div>
      <div className="fc-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Paper</th>
              <th>Title</th>
              <th>Reviews</th>
              <th>Decision</th>
              <th>Next</th>
            </tr>
          </thead>
          <tbody>
            {papers.map((paper, index) => (
              <tr key={paper.id}>
                <td>{paper.id}</td>
                <td>{paper.title}</td>
                <td>{paper.review}</td>
                <td>
                  <span
                    className={`fc-chip ${
                      paper.decision === 'Accept'
                        ? 'fc-chip-ok'
                        : paper.decision === 'Pending'
                          ? 'fc-chip-pending'
                          : 'fc-chip-blue'
                    }`}
                  >
                    {paper.decision}
                  </span>
                </td>
                <td>{index === 0 ? 'Final file' : index === 1 ? 'Record' : 'Round 2'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="fc-ledger-note">
        <span className="fc-signal-dot" />
        Synthetic data shown for product illustration
      </div>
    </div>
  );
}

function CapabilityEvidence({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <article className="fc-evidence">
      <div className="flex items-center gap-3 text-[var(--fc-blue)]">
        {icon}
        <h3>{title}</h3>
      </div>
      <p>{description}</p>
      <div className="fc-evidence-demo">{children}</div>
    </article>
  );
}

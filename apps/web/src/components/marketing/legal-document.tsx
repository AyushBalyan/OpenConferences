import Link from 'next/link';
import type { ReactNode } from 'react';

export type LegalSection = {
  id: string;
  title: string;
  body: ReactNode;
};

type LegalDocumentProps = {
  title: string;
  updated: string;
  lede: string;
  sections: LegalSection[];
};

export function LegalDocument({ title, updated, lede, sections }: LegalDocumentProps) {
  return (
    <div className="fc-landing fc-legal">
      <nav className="fc-nav" aria-label="Primary navigation">
        <div className="fc-shell flex h-16 items-center justify-between">
          <Link href="/" className="fc-wordmark" aria-label="FresiCMT home">
            Fresi<span>CMT</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="fc-text-link">
              Sign in
            </Link>
            <Link href="/sign-up" className="fc-button fc-button-ink">
              Create account
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <article className="fc-legal-doc">
          <h1>{title}</h1>
          <p className="fc-legal-meta">Last updated {updated}</p>
          <p className="fc-legal-lede">{lede}</p>

          <nav className="fc-legal-toc" aria-label="Contents">
            {sections.map((section, index) => (
              <a key={section.id} href={`#${section.id}`}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                {section.title}
              </a>
            ))}
          </nav>

          {sections.map((section) => (
            <section key={section.id} id={section.id} className="fc-legal-section">
              <h2>{section.title}</h2>
              {section.body}
            </section>
          ))}
        </article>
      </main>

      <footer className="bg-white">
        <div className="fc-shell flex flex-col gap-3 border-t border-zinc-200 py-6 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 FresiCMT</span>
          <span className="flex gap-4">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href="mailto:contact@fresi.org">Contact</a>
          </span>
        </div>
      </footer>
    </div>
  );
}

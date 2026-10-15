'use client';

import { useParams } from 'next/navigation';
import { DecisionsWorkspaceProvider } from '@/components/dashboard/reviews/decisions/decisions-workspace';
import {
  DecisionsAlerts,
  DecisionsRoundBar,
  DecisionsSearch,
} from '@/components/dashboard/reviews/decisions/decisions-panels';
import { SectionLayoutFrame } from '@/components/dashboard/section-layout-frame';
import { SECTION_PAGE_META } from '@/lib/conference-nav';

export default function DecisionsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const meta = SECTION_PAGE_META.decisions;

  return (
    <DecisionsWorkspaceProvider conferenceId={params.id}>
      <SectionLayoutFrame
        title={meta.title}
        description={meta.description}
        alerts={<DecisionsAlerts />}
        toolbar={
          <div className="mb-6 space-y-4">
            <DecisionsRoundBar />
            <DecisionsSearch />
          </div>
        }
      >
        {children}
      </SectionLayoutFrame>
    </DecisionsWorkspaceProvider>
  );
}

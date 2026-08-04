'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { conferenceWorkspaceHref, roleLabels } from '@/lib/roles';

type DashboardConference = {
  id: string;
  name: string;
  slug: string;
  status: string;
  myRoles: string[];
};

export function DashboardConferenceCards({
  conferences,
  actionLabel = 'Open workspace',
}: {
  conferences: DashboardConference[];
  actionLabel?: string;
}) {
  if (conferences.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {conferences.map((conference) => {
        const labels = roleLabels(conference.myRoles);
        const href = conferenceWorkspaceHref(conference.id, conference.myRoles);

        return (
          <Card key={conference.id} className="group transition-shadow hover:shadow-md">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-lg">{conference.name}</CardTitle>
                <StatusBadge status={conference.status} />
              </div>
              <CardDescription>
                {conference.slug}
                {labels.length > 0 ? ` · ${labels.join(', ')}` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="group-hover:border-indigo-300">
                <Link href={href}>
                  {actionLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

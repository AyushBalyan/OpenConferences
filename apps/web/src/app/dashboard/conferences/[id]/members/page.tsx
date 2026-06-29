'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { ConferenceNav } from '@/components/dashboard/conference-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchMembers, grantRole, revokeRole } from '@/lib/api-client';
import type { Member } from '@/lib/conference-types';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const GRANTABLE_ROLES = ['AUTHOR', 'REVIEWER', 'CHAIR', 'ORGANIZER'] as const;

type GrantableRole = (typeof GRANTABLE_ROLES)[number];

function isGrantableRole(role: string): role is GrantableRole {
  return (GRANTABLE_ROLES as readonly string[]).includes(role);
}

export default function ConferenceMembersPage() {
  return (
    <ProtectedRoute>
      <MembersContent />
    </ProtectedRoute>
  );
}

function MembersContent() {
  const params = useParams<{ id: string }>();
  const conferenceId = params.id;
  const [members, setMembers] = useState<Member[]>([]);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<GrantableRole>('AUTHOR');
  const [error, setError] = useState<string | null>(null);
  const [revokingKey, setRevokingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await fetchMembers(conferenceId);
    setMembers(data);
  }, [conferenceId]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [load]);

  async function onGrant(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const updated = await grantRole(conferenceId, {
        userId,
        role,
        scope: 'CONFERENCE',
      });
      setMembers(updated);
      setUserId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to grant role');
    }
  }

  async function onRevoke(member: Member, roleToRevoke: string) {
    if (!isGrantableRole(roleToRevoke) && roleToRevoke !== 'ORG_ADMIN') {
      return;
    }

    const key = `${member.membershipId}:${roleToRevoke}`;
    setError(null);
    setRevokingKey(key);
    try {
      const updated = await revokeRole(conferenceId, {
        userId: member.userId,
        role: roleToRevoke as GrantableRole | 'ORG_ADMIN',
        scope: member.scope,
      });
      setMembers(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke role');
    } finally {
      setRevokingKey(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/dashboard/conferences/${conferenceId}`} className="hover:underline">
            Back to overview
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">Members & roles</h1>
      </div>
      <ConferenceNav conferenceId={conferenceId} />

      <Card>
        <CardHeader>
          <CardTitle>Grant role</CardTitle>
          <CardDescription>
            Assign conference-scoped roles (privilege ceiling enforced).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-3" onSubmit={onGrant}>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="userId">User ID</Label>
              <Input id="userId" value={userId} onChange={(e) => setUserId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as GrantableRole)}
              >
                {GRANTABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" className="w-fit">
              Grant
            </Button>
          </form>
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {members.map((member) => (
          <Card key={member.membershipId}>
            <CardHeader>
              <CardTitle className="text-base">{member.name}</CardTitle>
              <CardDescription>
                {member.email} · {member.scope}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {member.roles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No roles assigned.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {member.roles.map((memberRole) => {
                    const key = `${member.membershipId}:${memberRole}`;
                    const canRevoke = isGrantableRole(memberRole) || memberRole === 'ORG_ADMIN';
                    return (
                      <li
                        key={key}
                        className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 text-sm"
                      >
                        <span className="font-medium">{memberRole}</span>
                        {canRevoke ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-destructive hover:text-destructive"
                            disabled={revokingKey === key}
                            onClick={() => onRevoke(member, memberRole)}
                          >
                            {revokingKey === key ? 'Revoking…' : 'Revoke'}
                          </Button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        ) : null}
      </div>
    </div>
  );
}

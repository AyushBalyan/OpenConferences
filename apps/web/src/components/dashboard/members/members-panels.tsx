'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { grantRole, revokeRole } from '@/lib/api-client';
import type { Member } from '@/lib/conference-types';
import { useState } from 'react';
import { useMembersWorkspace } from './members-workspace';

const GRANTABLE_ROLES = ['AUTHOR', 'REVIEWER', 'CHAIR', 'ORGANIZER'] as const;
type GrantableRole = (typeof GRANTABLE_ROLES)[number];

function isGrantableRole(role: string): role is GrantableRole {
  return (GRANTABLE_ROLES as readonly string[]).includes(role);
}

export function MembersGrantPanel() {
  const { conferenceId, setMembers, setError } = useMembersWorkspace();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<GrantableRole>('AUTHOR');

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

  return (
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
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
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
      </CardContent>
    </Card>
  );
}

export function MembersDirectoryPanel() {
  const {
    conferenceId,
    members,
    error,
    setError,
    revokingKey,
    setRevokingKey,
    setMembers,
    loading,
  } = useMembersWorkspace();

  async function onRevoke(member: Member, roleToRevoke: string) {
    if (!isGrantableRole(roleToRevoke) && roleToRevoke !== 'ORG_ADMIN') return;

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

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {members.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">
            No members yet.
          </CardContent>
        </Card>
      ) : (
        members.map((member) => (
          <Card key={member.membershipId}>
            <CardHeader>
              <CardTitle className="text-base">{member.name}</CardTitle>
              <CardDescription>
                {member.email} · {member.scope}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {member.roles.length === 0 ? (
                <p className="text-sm text-slate-500">No roles assigned.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {member.roles.map((memberRole) => {
                    const key = `${member.membershipId}:${memberRole}`;
                    const canRevoke = isGrantableRole(memberRole) || memberRole === 'ORG_ADMIN';
                    return (
                      <li
                        key={key}
                        className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm"
                      >
                        <span className="font-medium">{memberRole}</span>
                        {canRevoke ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-rose-600 hover:text-rose-700"
                            disabled={revokingKey === key}
                            onClick={() => void onRevoke(member, memberRole)}
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
        ))
      )}
    </div>
  );
}

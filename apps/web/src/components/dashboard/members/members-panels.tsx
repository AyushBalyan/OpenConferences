'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFooter,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/components/dashboard/data-table';
import { WorkflowBadge } from '@/components/dashboard/workflow-badge';
import { grantRole, revokeRole } from '@/lib/api-client';
import type { Member } from '@/lib/conference-types';
import { useState } from 'react';
import { useMembersWorkspace } from './members-workspace';
import {
  categoryRolesForMember,
  filterMembersByCategory,
  formatMemberScope,
  formatRoleLabel,
  type MemberCategory,
} from './members-utils';

const GRANTABLE_ROLES = ['AUTHOR', 'REVIEWER', 'CHAIR', 'ORGANIZER'] as const;
type GrantableRole = (typeof GRANTABLE_ROLES)[number];

function isGrantableRole(role: string): role is GrantableRole {
  return (GRANTABLE_ROLES as readonly string[]).includes(role);
}

function scopeTone(scope: Member['scope']) {
  return scope === 'ORGANIZATION' ? 'info' : 'neutral';
}

function roleTone(role: string) {
  if (role === 'PLATFORM_ADMIN' || role === 'ORG_ADMIN') return 'info';
  if (role === 'ORGANIZER' || role === 'CHAIR') return 'success';
  if (role === 'REVIEWER') return 'pending';
  return 'neutral';
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
                  {formatRoleLabel(r)}
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

type MembersTablePanelProps = {
  category: MemberCategory;
  emptyMessage: string;
};

export function MembersTablePanel({ category, emptyMessage }: MembersTablePanelProps) {
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

  const filteredMembers = filterMembersByCategory(members, category);

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
        <Skeleton className="h-10 w-full rounded-xl" />
        {[1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {filteredMembers.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">
            {emptyMessage}
          </CardContent>
        </Card>
      ) : (
        <DataTable
          footer={
            <DataTableFooter>
              {filteredMembers.length} member{filteredMembers.length === 1 ? '' : 's'}
            </DataTableFooter>
          }
        >
          <DataTableHeader>
            <tr>
              <DataTableHead>Name</DataTableHead>
              <DataTableHead>Email</DataTableHead>
              <DataTableHead>Scope</DataTableHead>
              <DataTableHead>Roles</DataTableHead>
              <DataTableHead className="text-right">Actions</DataTableHead>
            </tr>
          </DataTableHeader>
          <DataTableBody>
            {filteredMembers.map((member) => {
              const roles = categoryRolesForMember(member, category);

              return (
                <DataTableRow key={member.membershipId}>
                  <DataTableCell>
                    <p className="font-medium text-slate-900">{member.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-slate-400">{member.userId}</p>
                  </DataTableCell>
                  <DataTableCell>{member.email}</DataTableCell>
                  <DataTableCell>
                    <WorkflowBadge
                      label={formatMemberScope(member.scope)}
                      tone={scopeTone(member.scope)}
                    />
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {roles.map((role) => (
                        <WorkflowBadge
                          key={`${member.membershipId}:${role}`}
                          label={formatRoleLabel(role)}
                          tone={roleTone(role)}
                        />
                      ))}
                    </div>
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {roles.map((role) => {
                        const key = `${member.membershipId}:${role}`;
                        const canRevoke = isGrantableRole(role) || role === 'ORG_ADMIN';
                        if (!canRevoke) return null;

                        return (
                          <Button
                            key={key}
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-rose-600 hover:text-rose-700"
                            disabled={revokingKey === key}
                            onClick={() => void onRevoke(member, role)}
                          >
                            {revokingKey === key ? 'Revoking…' : `Revoke ${formatRoleLabel(role)}`}
                          </Button>
                        );
                      })}
                    </div>
                  </DataTableCell>
                </DataTableRow>
              );
            })}
          </DataTableBody>
        </DataTable>
      )}
    </div>
  );
}

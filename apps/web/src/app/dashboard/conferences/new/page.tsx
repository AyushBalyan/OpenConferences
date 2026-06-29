'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createConference, fetchOrganizations } from '@/lib/api-client';
import { createConferenceSchema } from '@openconferences/schemas';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

type FormValues = z.infer<typeof createConferenceSchema>;

export default function NewConferencePage() {
  return (
    <ProtectedRoute>
      <NewConferenceContent />
    </ProtectedRoute>
  );
}

function NewConferenceContent() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(createConferenceSchema),
  });

  useEffect(() => {
    fetchOrganizations()
      .then(setOrgs)
      .catch(() => setError('Failed to load organizations'));
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const conference = await createConference(values);
      router.push(`/dashboard/conferences/${conference.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create conference');
    }
  });

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Create conference</CardTitle>
          <CardDescription>
            Set up a new conference edition under your organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="organizationId">Organization</Label>
              <select
                id="organizationId"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...register('organizationId')}
              >
                <option value="">Select organization</option>
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
              {errors.organizationId ? (
                <p className="text-sm text-destructive">{errors.organizationId.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register('name')} />
              {errors.name ? (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" placeholder="iccv-2026" {...register('slug')} />
              {errors.slug ? (
                <p className="text-sm text-destructive">{errors.slug.message}</p>
              ) : null}
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating…' : 'Create'}
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

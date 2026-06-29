'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { useSession } from '@/lib/auth-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const { data: session } = useSession();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Welcome, {session?.user.name}</CardTitle>
          <CardDescription>Signed in as {session?.user.email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Conference management features arrive in Phase 2. Your global identity is ready.
          </p>
          <Button asChild variant="outline">
            <Link href="/mfa/enroll">Enable MFA</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

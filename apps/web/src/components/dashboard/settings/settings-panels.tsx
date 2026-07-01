'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useSettingsWorkspace } from './settings-workspace';

function SettingsFeedback() {
  const { error, saved } = useSettingsWorkspace();
  return (
    <>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-700">Settings saved.</p> : null}
    </>
  );
}

export function SettingsPhasesPanel() {
  const { form, setForm, loading, save } = useSettingsWorkspace();

  if (loading) return <Skeleton className="h-64 w-full rounded-xl" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Phases & blinding</CardTitle>
        <CardDescription>
          Configure review blinding mode and conference phase windows.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="blindingMode">Blinding mode</Label>
            <select
              id="blindingMode"
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={form.blindingMode}
              onChange={(e) => setForm({ ...form, blindingMode: e.target.value })}
            >
              <option value="SINGLE">Single blind</option>
              <option value="DOUBLE">Double blind</option>
              <option value="OPEN">Open</option>
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cfpOpensAt">CFP opens</Label>
              <Input
                id="cfpOpensAt"
                type="datetime-local"
                value={form.cfpOpensAt}
                onChange={(e) => setForm({ ...form, cfpOpensAt: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfpClosesAt">CFP closes</Label>
              <Input
                id="cfpClosesAt"
                type="datetime-local"
                value={form.cfpClosesAt}
                onChange={(e) => setForm({ ...form, cfpClosesAt: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reviewDueAt">Review due</Label>
              <Input
                id="reviewDueAt"
                type="datetime-local"
                value={form.reviewDueAt}
                onChange={(e) => setForm({ ...form, reviewDueAt: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="decisionDueAt">Decision due</Label>
              <Input
                id="decisionDueAt"
                type="datetime-local"
                value={form.decisionDueAt}
                onChange={(e) => setForm({ ...form, decisionDueAt: e.target.value })}
              />
            </div>
          </div>

          <SettingsFeedback />
          <Button type="submit">Save phases</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function SettingsFeesPanel() {
  const { form, setForm, loading, save } = useSettingsWorkspace();

  if (loading) return <Skeleton className="h-64 w-full rounded-xl" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fee schedule</CardTitle>
        <CardDescription>Registration fees in minor currency units (e.g. paise).</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="regularEarly">Regular early</Label>
              <Input
                id="regularEarly"
                value={form.regularEarly}
                onChange={(e) => setForm({ ...form, regularEarly: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="regularRegular">Regular regular</Label>
              <Input
                id="regularRegular"
                value={form.regularRegular}
                onChange={(e) => setForm({ ...form, regularRegular: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="studentEarly">Student early</Label>
              <Input
                id="studentEarly"
                value={form.studentEarly}
                onChange={(e) => setForm({ ...form, studentEarly: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="studentRegular">Student regular</Label>
              <Input
                id="studentRegular"
                value={form.studentRegular}
                onChange={(e) => setForm({ ...form, studentRegular: e.target.value })}
              />
            </div>
          </div>

          <SettingsFeedback />
          <Button type="submit">Save fees</Button>
        </form>
      </CardContent>
    </Card>
  );
}

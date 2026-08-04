'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useSettingsWorkspace, type SettingsForm } from './settings-workspace';

function SettingsFeedback() {
  const { error, saved } = useSettingsWorkspace();
  return (
    <>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-700">Settings saved.</p> : null}
    </>
  );
}

function PhaseField({
  id,
  label,
  value,
  onChange,
}: {
  id: keyof SettingsForm;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function SettingsPhasesPanel() {
  const { form, setForm, loading, save } = useSettingsWorkspace();

  if (loading) return <Skeleton className="h-64 w-full rounded-xl" />;

  function updateField(key: keyof SettingsForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Phases & blinding</CardTitle>
        <CardDescription>
          Configure review blinding and conference phase windows. All times are UTC (GMT).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-8"
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
              onChange={(e) => updateField('blindingMode', e.target.value)}
            >
              <option value="SINGLE">Single blind</option>
              <option value="DOUBLE">Double blind</option>
              <option value="OPEN">Open</option>
            </select>
          </div>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium text-slate-900">Call for papers</h3>
              <p className="text-xs text-slate-500">Submission window for new manuscripts.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <PhaseField
                id="cfpOpensAt"
                label="CFP opens"
                value={form.cfpOpensAt}
                onChange={(value) => updateField('cfpOpensAt', value)}
              />
              <PhaseField
                id="cfpClosesAt"
                label="CFP closes"
                value={form.cfpClosesAt}
                onChange={(value) => updateField('cfpClosesAt', value)}
              />
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium text-slate-900">Bidding</h3>
              <p className="text-xs text-slate-500">Reviewer interest window before assignment.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <PhaseField
                id="biddingOpensAt"
                label="Bidding opens"
                value={form.biddingOpensAt}
                onChange={(value) => updateField('biddingOpensAt', value)}
              />
              <PhaseField
                id="biddingClosesAt"
                label="Bidding closes"
                value={form.biddingClosesAt}
                onChange={(value) => updateField('biddingClosesAt', value)}
              />
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium text-slate-900">Review cycle</h3>
              <p className="text-xs text-slate-500">
                Review, rebuttal, and decision deadlines for the program committee.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <PhaseField
                id="reviewDueAt"
                label="Review due"
                value={form.reviewDueAt}
                onChange={(value) => updateField('reviewDueAt', value)}
              />
              <PhaseField
                id="rebuttalDueAt"
                label="Rebuttal due"
                value={form.rebuttalDueAt}
                onChange={(value) => updateField('rebuttalDueAt', value)}
              />
              <PhaseField
                id="decisionDueAt"
                label="Decision due"
                value={form.decisionDueAt}
                onChange={(value) => updateField('decisionDueAt', value)}
              />
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium text-slate-900">Post-acceptance</h3>
              <p className="text-xs text-slate-500">
                Camera-ready uploads require a due date. Registration uses the registration due
                window.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <PhaseField
                id="cameraReadyDueAt"
                label="Camera-ready due"
                value={form.cameraReadyDueAt}
                onChange={(value) => updateField('cameraReadyDueAt', value)}
              />
              <PhaseField
                id="registrationDueAt"
                label="Registration due"
                value={form.registrationDueAt}
                onChange={(value) => updateField('registrationDueAt', value)}
              />
            </div>
          </section>

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

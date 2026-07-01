'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  createNotificationTemplate,
  fetchNotificationTemplates,
  updateNotificationTemplate,
} from '@/lib/api-client';
import type { NotificationTemplateEntry } from '@/lib/conference-types';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function NotificationTemplatesPage() {
  return <TemplatesContent />;
}

function TemplatesContent() {
  const params = useParams<{ id: string }>();
  const conferenceId = params.id;
  const [templates, setTemplates] = useState<NotificationTemplateEntry[]>([]);
  const [selected, setSelected] = useState<NotificationTemplateEntry | null>(null);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [variables, setVariables] = useState('');
  const [newKey, setNewKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchNotificationTemplates(conferenceId);
    setTemplates(data);
    if (!selected && data[0]) {
      setSelected(data[0]);
      setSubject(data[0].subject);
      setBodyHtml(data[0].bodyHtml);
      setVariables(data[0].variables.join(', '));
    }
  }, [conferenceId, selected]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [load]);

  function selectTemplate(template: NotificationTemplateEntry) {
    setSelected(template);
    setSubject(template.subject);
    setBodyHtml(template.bodyHtml);
    setVariables(template.variables.join(', '));
  }

  async function handleSaveNewVersion() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const vars = variables
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      await createNotificationTemplate(conferenceId, {
        key: selected.key,
        subject,
        bodyHtml,
        variables: vars,
        isActive: true,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateTemplate() {
    if (!newKey.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createNotificationTemplate(conferenceId, {
        key: newKey.trim(),
        subject: 'Subject with {{variable}}',
        bodyHtml: '<p>Hello {{name}}</p>',
        variables: ['name'],
        isActive: true,
      });
      setNewKey('');
      await load();
      selectTemplate(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(template: NotificationTemplateEntry) {
    setSaving(true);
    setError(null);
    try {
      await updateNotificationTemplate(conferenceId, template.id, {
        isActive: !template.isActive,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email templates"
        description="Organization-scoped, versioned templates with auto-escaped variables."
        actions={
          <Button variant="outline" asChild>
            <Link href={`/dashboard/conferences/${conferenceId}/notifications`}>Email log</Link>
          </Button>
        }
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          {templates.map((template) => (
            <Card
              key={template.id}
              className={selected?.id === template.id ? 'border-primary' : undefined}
            >
              <CardHeader className="cursor-pointer" onClick={() => selectTemplate(template)}>
                <CardTitle className="text-sm">{template.key}</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  v{template.version}
                  {template.isActive ? (
                    <Badge>Active</Badge>
                  ) : (
                    <Badge variant="outline">Inactive</Badge>
                  )}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}

          <div className="space-y-2 rounded-lg border p-4">
            <Label htmlFor="new-key">New template key</Label>
            <Input
              id="new-key"
              placeholder="e.g. submission.confirmed"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
            <Button size="sm" disabled={saving} onClick={() => void handleCreateTemplate()}>
              Create template
            </Button>
          </div>
        </div>

        {selected ? (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{selected.key}</h3>
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => void handleToggleActive(selected)}
              >
                {selected.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Body HTML</Label>
              <Textarea
                id="body"
                rows={10}
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="variables">Variables (comma-separated)</Label>
              <Input
                id="variables"
                value={variables}
                onChange={(e) => setVariables(e.target.value)}
              />
            </div>

            <Button disabled={saving} onClick={() => void handleSaveNewVersion()}>
              Save as new version
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamicImport from 'next/dynamic';
import type { EditorRef } from 'react-email-editor';
import { toast } from 'sonner';

export const dynamic = 'force-dynamic';

// Unlayer must be client-side only
const EmailEditor = dynamicImport(
  () => import('react-email-editor').then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        Loading editor…
      </div>
    ),
  }
);

// Merge tags available in all templates
const MERGE_TAGS = {
  tag_0: { name: 'First Name', value: '{{firstName}}' },
  tag_1: { name: 'Last Name', value: '{{lastName}}' },
  tag_2: { name: 'Email', value: '{{email}}' },
};

const MERGE_TAG_HINTS = ['{{firstName}}', '{{lastName}}', '{{email}}'];

type Template = {
  id: string;
  name: string;
  subject: string;
  designJson: Record<string, unknown> | null;
  bodyHtml: string | null;
  isActive: boolean;
  updatedAt: string;
};

function formatDate(s: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(s));
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [editorReady, setEditorReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const editorRef = useRef<EditorRef>(null);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      setTemplates(data.templates);
    } catch {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  function openCreate() {
    setEditingId(null);
    setFormName('');
    setFormSubject('');
    setEditorReady(false);
    setEditorOpen(true);
  }

  function openEdit(t: Template) {
    setEditingId(t.id);
    setFormName(t.name);
    setFormSubject(t.subject);
    setEditorReady(false);
    setEditorOpen(true);
  }

  function onEditorReady() {
    setEditorReady(true);
    if (editingId) {
      const tpl = templates.find((t) => t.id === editingId);
      if (tpl?.designJson) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (editorRef.current as any)?.editor?.loadDesign(tpl.designJson);
      }
    }
  }

  async function handleSave() {
    if (!formName.trim()) { toast.error('Name is required'); return; }
    if (!formSubject.trim()) { toast.error('Subject is required'); return; }
    if (!editorReady) { toast.error('Editor not ready yet'); return; }

    setSaving(true);
    try {
      await new Promise<void>((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (editorRef.current as any)?.editor?.exportHtml(
          (data: { design: unknown; html: string }) => {
            const url = editingId
              ? `/api/templates/${editingId}`
              : '/api/templates';
            const method = editingId ? 'PATCH' : 'POST';
            const payload = {
              name: formName,
              subject: formSubject,
              designJson: data.design,
              bodyHtml: data.html,
            };
            fetch(url, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
              .then((res) => { if (!res.ok) throw new Error(); resolve(); })
              .catch(reject);
          }
        );
      });
      toast.success(editingId ? 'Template saved' : 'Template created');
      setEditorOpen(false);
      loadTemplates();
    } catch {
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Template deleted');
      loadTemplates();
    } catch {
      toast.error('Failed to delete template');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <div className="px-4 py-6 lg:px-8 lg:py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              Templates
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Design reusable email templates for campaigns and automations.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            New template
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-400">Loading…</p>
        ) : templates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-6 py-16 text-center">
            <p className="text-sm font-medium text-zinc-700">No templates yet</p>
            <p className="mt-1 text-sm text-zinc-400">
              Create a template to use in campaigns and automations.
            </p>
            <button
              onClick={openCreate}
              className="mt-4 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
            >
              New template
            </button>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white overflow-hidden">
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-900 truncate">{t.name}</p>
                    {!t.bodyHtml && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Draft
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500 truncate">
                    {t.subject}
                    <span className="mx-1.5 text-zinc-300">&middot;</span>
                    Updated {formatDate(t.updatedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => openEdit(t)}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(t.id, t.name)}
                    disabled={deleting === t.id}
                    className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                  >
                    {deleting === t.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full-screen Unlayer editor */}
      {editorOpen && (
        <div
          className="fixed inset-0 z-50 bg-white"
          style={{ display: 'grid', gridTemplateRows: '56px 56px 1fr 56px' }}
        >
          {/* Row 1: Header */}
          <div className="flex items-center justify-between px-6 border-b border-zinc-200">
            <div className="flex items-center gap-4 min-w-0">
              <span className="font-medium text-sm text-zinc-900">
                {editingId ? 'Edit template' : 'New template'}
              </span>
              <span className="hidden sm:inline text-xs text-zinc-400 truncate">
                Merge tags: {MERGE_TAG_HINTS.join(', ')}
              </span>
            </div>
            <button
              onClick={() => { if (!saving) setEditorOpen(false); }}
              className="shrink-0 ml-4 rounded-md px-3 py-1.5 text-xs font-medium text-zinc-600 border border-zinc-300 hover:bg-zinc-50 transition-colors"
            >
              Close
            </button>
          </div>

          {/* Row 2: Fields bar */}
          <div className="flex items-center gap-6 px-6 border-b border-zinc-200 overflow-hidden">
            <div className="flex items-center gap-2 shrink-0">
              <label className="text-xs font-medium text-zinc-700 shrink-0">Name</label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Welcome email"
                className="w-44 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <label className="text-xs font-medium text-zinc-700 shrink-0">Subject</label>
              <input
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                placeholder="e.g. Welcome, {{firstName}}!"
                className="flex-1 min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>

          {/* Row 3: Unlayer editor (fills all remaining space) */}
          <div style={{ display: 'flex', overflow: 'hidden' }}>
            <EmailEditor
              ref={editorRef}
              onReady={onEditorReady}
              minHeight={0}
              options={{
                mergeTags: MERGE_TAGS,
                appearance: { theme: 'light' },
              }}
              style={{ height: '100%' }}
            />
          </div>

          {/* Row 4: Footer */}
          <div className="flex items-center justify-end gap-2 px-6 border-t border-zinc-200">
            <button
              onClick={() => setEditorOpen(false)}
              disabled={saving}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !editorReady}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors disabled:opacity-40"
            >
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create template'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

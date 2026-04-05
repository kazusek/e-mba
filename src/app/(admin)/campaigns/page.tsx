'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export const dynamic = 'force-dynamic';

type Campaign = {
  id: string;
  name: string;
  status: 'draft' | 'sending' | 'sent' | 'failed';
  recipientCount: number | null;
  sentAt: string | null;
  createdAt: string;
  templateId: string | null;
  audienceId: string | null;
  templateName: string | null;
  audienceName: string | null;
};

type Template = { id: string; name: string };
type Audience = { id: string; name: string };

const STATUS_STYLES: Record<Campaign['status'], string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  sending: 'bg-amber-100 text-amber-700',
  sent: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

function formatDate(s: string | null) {
  if (!s) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(s));
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formTemplateId, setFormTemplateId] = useState('');
  const [formAudienceId, setFormAudienceId] = useState('');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [cRes, tRes, aRes] = await Promise.all([
      fetch('/api/campaigns'),
      fetch('/api/templates'),
      fetch('/api/audiences'),
    ]);
    const [cData, tData, aData] = await Promise.all([cRes.json(), tRes.json(), aRes.json()]);
    setCampaigns(cData.campaigns ?? []);
    setTemplates(tData.templates ?? []);
    setAudiences(aData.audiences ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  function openCreate() {
    setEditingId(null);
    setFormName('');
    setFormTemplateId(templates[0]?.id ?? '');
    setFormAudienceId(audiences[0]?.id ?? '');
    setDialogOpen(true);
  }

  function openEdit(c: Campaign) {
    setEditingId(c.id);
    setFormName(c.name);
    setFormTemplateId(c.templateId ?? '');
    setFormAudienceId(c.audienceId ?? '');
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) { toast.error('Name is required'); return; }
    if (!formTemplateId) { toast.error('Select a template'); return; }
    if (!formAudienceId) { toast.error('Select an audience'); return; }

    setSaving(true);
    try {
      const url = editingId ? `/api/campaigns/${editingId}` : '/api/campaigns';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName, templateId: formTemplateId, audienceId: formAudienceId }),
      });
      if (!res.ok) throw new Error();
      toast.success(editingId ? 'Campaign updated' : 'Campaign created');
      setDialogOpen(false);
      loadAll();
    } catch {
      toast.error('Failed to save campaign');
    } finally {
      setSaving(false);
    }
  }

  async function handleSend(id: string, name: string) {
    if (!confirm(`Send "${name}" now? This will email all matching contacts.`)) return;
    setSending(id);
    try {
      const res = await fetch(`/api/campaigns/${id}/send`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Send failed'); return; }
      toast.success(`Sent to ${data.sent} contacts${data.failed ? ` (${data.failed} failed)` : ''}`);
      loadAll();
    } catch {
      toast.error('Send failed');
    } finally {
      setSending(null);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Delete failed'); return; }
      toast.success('Campaign deleted');
      loadAll();
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <div className="px-4 py-6 lg:px-8 lg:py-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Campaigns</h1>
            <p className="mt-1 text-sm text-zinc-500">One-time email sends to an audience segment.</p>
          </div>
          <button
            onClick={openCreate}
            className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            New campaign
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-400">Loading…</p>
        ) : campaigns.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-6 py-16 text-center">
            <p className="text-sm font-medium text-zinc-700">No campaigns yet</p>
            <p className="mt-1 text-sm text-zinc-400">Create a campaign to send a one-time email.</p>
            <button
              onClick={openCreate}
              className="mt-4 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
            >
              New campaign
            </button>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white overflow-hidden">
            {campaigns.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-zinc-900 truncate">{c.name}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[c.status]}`}>
                      {c.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500 truncate">
                    {c.audienceName ?? 'No audience'}
                    <span className="mx-1.5 text-zinc-300">&middot;</span>
                    {c.templateName ?? 'No template'}
                    {c.status === 'sent' && c.sentAt && (
                      <>
                        <span className="mx-1.5 text-zinc-300">&middot;</span>
                        Sent {formatDate(c.sentAt)}
                        {c.recipientCount != null && ` to ${c.recipientCount} contacts`}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {c.status === 'draft' && (
                    <>
                      <button
                        onClick={() => handleSend(c.id, c.name)}
                        disabled={sending === c.id}
                        className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 transition-colors disabled:opacity-40"
                      >
                        {sending === c.id ? 'Sending…' : 'Send now'}
                      </button>
                      <button
                        onClick={() => openEdit(c)}
                        className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        disabled={deleting === c.id}
                        className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                      >
                        {deleting === c.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="px-6 py-5 border-b border-zinc-200">
              <h2 className="text-base font-semibold text-zinc-900">
                {editingId ? 'Edit campaign' : 'New campaign'}
              </h2>
            </div>
            <form onSubmit={handleSave} className="px-6 py-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Name</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. July re-engagement"
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Template</label>
                <select
                  value={formTemplateId}
                  onChange={(e) => setFormTemplateId(e.target.value)}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                >
                  <option value="">Select a template…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Audience</label>
                <select
                  value={formAudienceId}
                  onChange={(e) => setFormAudienceId(e.target.value)}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                >
                  <option value="">Select an audience…</option>
                  {audiences.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  disabled={saving}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors disabled:opacity-40"
                >
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

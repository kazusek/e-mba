'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export const dynamic = 'force-dynamic';

type TriggerEvent = 'new_client' | 'lapsed_client' | 'membership_expiring';
type DelayUnit = 'minutes' | 'hours' | 'days';

type Automation = {
  id: string;
  name: string;
  isActive: boolean;
  triggerEvent: TriggerEvent;
  delayAmount: number;
  delayUnit: DelayUnit;
  lapsedDays: number | null;
  expiryWarningDays: number | null;
  cooldownDays: number;
  templateId: string | null;
  templateName: string | null;
  createdAt: string;
};

type Template = { id: string; name: string };

const TRIGGER_LABELS: Record<TriggerEvent, string> = {
  new_client: 'New client',
  lapsed_client: 'Lapsed client',
  membership_expiring: 'Membership expiring',
};

const TRIGGER_DESCRIPTIONS: Record<TriggerEvent, string> = {
  new_client: 'Fires when a contact is first imported',
  lapsed_client: 'Fires via cron when a contact hasn\'t visited in N days',
  membership_expiring: 'Fires via cron when a membership expires within N days',
};

const DELAY_UNIT_LABELS: Record<DelayUnit, string> = {
  minutes: 'min',
  hours: 'hrs',
  days: 'days',
};

function delayLabel(amount: number, unit: DelayUnit) {
  if (amount === 0) return 'Immediately';
  return `After ${amount} ${DELAY_UNIT_LABELS[unit]}`;
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formTrigger, setFormTrigger] = useState<TriggerEvent>('new_client');
  const [formTemplateId, setFormTemplateId] = useState('');
  const [formDelayAmount, setFormDelayAmount] = useState(0);
  const [formDelayUnit, setFormDelayUnit] = useState<DelayUnit>('hours');
  const [formLapsedDays, setFormLapsedDays] = useState(30);
  const [formExpiryDays, setFormExpiryDays] = useState(7);
  const [formCooldownDays, setFormCooldownDays] = useState(30);
  const [formIsActive, setFormIsActive] = useState(false);

  const loadAll = useCallback(async () => {
    const [aRes, tRes] = await Promise.all([fetch('/api/automations'), fetch('/api/templates')]);
    const [aData, tData] = await Promise.all([aRes.json(), tRes.json()]);
    setAutomations(aData.automations ?? []);
    setTemplates(tData.templates ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  function openCreate() {
    setEditingId(null);
    setFormName('');
    setFormTrigger('new_client');
    setFormTemplateId(templates[0]?.id ?? '');
    setFormDelayAmount(0);
    setFormDelayUnit('hours');
    setFormLapsedDays(30);
    setFormExpiryDays(7);
    setFormCooldownDays(30);
    setFormIsActive(false);
    setDialogOpen(true);
  }

  function openEdit(a: Automation) {
    setEditingId(a.id);
    setFormName(a.name);
    setFormTrigger(a.triggerEvent);
    setFormTemplateId(a.templateId ?? '');
    setFormDelayAmount(a.delayAmount);
    setFormDelayUnit(a.delayUnit);
    setFormLapsedDays(a.lapsedDays ?? 30);
    setFormExpiryDays(a.expiryWarningDays ?? 7);
    setFormCooldownDays(a.cooldownDays);
    setFormIsActive(a.isActive);
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) { toast.error('Name is required'); return; }
    if (!formTemplateId) { toast.error('Select a template'); return; }

    const payload = {
      name: formName,
      triggerEvent: formTrigger,
      templateId: formTemplateId,
      delayAmount: formDelayAmount,
      delayUnit: formDelayUnit,
      lapsedDays: formTrigger === 'lapsed_client' ? formLapsedDays : null,
      expiryWarningDays: formTrigger === 'membership_expiring' ? formExpiryDays : null,
      cooldownDays: formCooldownDays,
      isActive: formIsActive,
    };

    setSaving(true);
    try {
      const url = editingId ? `/api/automations/${editingId}` : '/api/automations';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Save failed'); return; }
      toast.success(editingId ? 'Automation updated' : 'Automation created');
      setDialogOpen(false);
      loadAll();
    } catch {
      toast.error('Failed to save automation');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(a: Automation) {
    setToggling(a.id);
    try {
      const res = await fetch(`/api/automations/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !a.isActive }),
      });
      if (!res.ok) throw new Error();
      setAutomations((prev) =>
        prev.map((x) => (x.id === a.id ? { ...x, isActive: !x.isActive } : x))
      );
    } catch {
      toast.error('Failed to update automation');
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/automations/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Automation deleted');
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
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Automations</h1>
            <p className="mt-1 text-sm text-zinc-500">Trigger-based emails sent automatically when conditions are met.</p>
          </div>
          <button
            onClick={openCreate}
            className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            New automation
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-400">Loading…</p>
        ) : automations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-6 py-16 text-center">
            <p className="text-sm font-medium text-zinc-700">No automations yet</p>
            <p className="mt-1 text-sm text-zinc-400">Create an automation to send emails automatically.</p>
            <button
              onClick={openCreate}
              className="mt-4 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
            >
              New automation
            </button>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white overflow-hidden">
            {automations.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900 truncate">{a.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-500 truncate">
                    {TRIGGER_LABELS[a.triggerEvent]}
                    {a.triggerEvent === 'lapsed_client' && a.lapsedDays && ` (${a.lapsedDays}d inactive)`}
                    {a.triggerEvent === 'membership_expiring' && a.expiryWarningDays && ` (${a.expiryWarningDays}d notice)`}
                    <span className="mx-1.5 text-zinc-300">&middot;</span>
                    {delayLabel(a.delayAmount, a.delayUnit)}
                    <span className="mx-1.5 text-zinc-300">&middot;</span>
                    {a.templateName ?? 'No template'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {/* Active toggle */}
                  <button
                    onClick={() => handleToggle(a)}
                    disabled={toggling === a.id}
                    title={a.isActive ? 'Deactivate' : 'Activate'}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-40 ${
                      a.isActive ? 'bg-zinc-900' : 'bg-zinc-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                        a.isActive ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-xs text-zinc-500 w-14">
                    {a.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    onClick={() => openEdit(a)}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(a.id, a.name)}
                    disabled={deleting === a.id}
                    className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                  >
                    {deleting === a.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-zinc-200">
              <h2 className="text-base font-semibold text-zinc-900">
                {editingId ? 'Edit automation' : 'New automation'}
              </h2>
            </div>
            <form onSubmit={handleSave} className="px-6 py-5 flex flex-col gap-4">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Name</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Welcome email"
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              {/* Trigger */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Trigger</label>
                <select
                  value={formTrigger}
                  onChange={(e) => setFormTrigger(e.target.value as TriggerEvent)}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                >
                  {(Object.keys(TRIGGER_LABELS) as TriggerEvent[]).map((t) => (
                    <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>
                  ))}
                </select>
                <p className="text-xs text-zinc-400">{TRIGGER_DESCRIPTIONS[formTrigger]}</p>
              </div>

              {/* Trigger-specific fields */}
              {formTrigger === 'lapsed_client' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700">Days inactive</label>
                  <input
                    type="number"
                    min={1}
                    value={formLapsedDays}
                    onChange={(e) => setFormLapsedDays(Number(e.target.value))}
                    className="w-32 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                  <p className="text-xs text-zinc-400">Trigger after this many days without a visit</p>
                </div>
              )}
              {formTrigger === 'membership_expiring' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700">Days before expiry</label>
                  <input
                    type="number"
                    min={1}
                    value={formExpiryDays}
                    onChange={(e) => setFormExpiryDays(Number(e.target.value))}
                    className="w-32 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                  <p className="text-xs text-zinc-400">Trigger this many days before the membership end date</p>
                </div>
              )}

              {/* Template */}
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

              {/* Delay */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Send delay</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={formDelayAmount}
                    onChange={(e) => setFormDelayAmount(Number(e.target.value))}
                    className="w-24 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                  <select
                    value={formDelayUnit}
                    onChange={(e) => setFormDelayUnit(e.target.value as DelayUnit)}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
                <p className="text-xs text-zinc-400">0 = send immediately when triggered</p>
              </div>

              {/* Cooldown */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Cooldown (days)</label>
                <input
                  type="number"
                  min={0}
                  value={formCooldownDays}
                  onChange={(e) => setFormCooldownDays(Number(e.target.value))}
                  className="w-32 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
                <p className="text-xs text-zinc-400">Minimum days between sends to the same contact</p>
              </div>

              {/* Active */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormIsActive(!formIsActive)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                    formIsActive ? 'bg-zinc-900' : 'bg-zinc-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                      formIsActive ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-sm text-zinc-700">{formIsActive ? 'Active' : 'Inactive'}</span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
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
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create automation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

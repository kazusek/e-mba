'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AUDIENCE_FIELDS,
  OP_LABELS,
  defaultValueForField,
} from '@/lib/audiences/fields';
import type { AudienceRules, Condition, RuleOp, RuleOperator } from '@/lib/audiences/fields';

type ConditionRow = Condition & { uid: string };

type PreviewResult = {
  count: number;
  sample: { email: string; name: string }[];
} | null;

type Props = {
  /** Pass for edit mode; omit for create */
  initialData?: {
    id: string;
    name: string;
    rules: AudienceRules;
  };
};

function newRow(field = 'totalVisits'): ConditionRow {
  const def = AUDIENCE_FIELDS.find((f) => f.value === field)!;
  return {
    uid: Math.random().toString(36).slice(2),
    field,
    op: def.ops[0],
    value: defaultValueForField(field),
  };
}

const VALUE_NEEDS_INPUT: RuleOp[] = ['eq', 'not_eq', 'gte', 'lte'];

export default function AudienceBuilderForm({ initialData }: Props) {
  const router = useRouter();

  const [name, setName] = useState(initialData?.name ?? '');
  const [operator, setOperator] = useState<RuleOperator>(
    initialData?.rules?.operator ?? 'AND'
  );
  const [conditions, setConditions] = useState<ConditionRow[]>(() => {
    if (initialData?.rules?.conditions?.length) {
      return initialData.rules.conditions.map((c) => ({
        ...c,
        uid: Math.random().toString(36).slice(2),
      }));
    }
    return [newRow()];
  });

  const [preview, setPreview] = useState<PreviewResult>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  // ---- condition helpers ----

  const addCondition = useCallback(() => {
    setConditions((prev) => [...prev, newRow()]);
    setPreview(null);
  }, []);

  const removeCondition = useCallback((uid: string) => {
    setConditions((prev) => prev.filter((c) => c.uid !== uid));
    setPreview(null);
  }, []);

  const updateField = useCallback((uid: string, field: string) => {
    setConditions((prev) =>
      prev.map((c) => {
        if (c.uid !== uid) return c;
        const def = AUDIENCE_FIELDS.find((f) => f.value === field)!;
        return { ...c, field, op: def.ops[0], value: defaultValueForField(field) };
      })
    );
    setPreview(null);
  }, []);

  const updateOp = useCallback((uid: string, op: RuleOp) => {
    setConditions((prev) =>
      prev.map((c) => {
        if (c.uid !== uid) return c;
        const needsValue = VALUE_NEEDS_INPUT.includes(op);
        const value = needsValue ? (c.value ?? defaultValueForField(c.field)) : null;
        return { ...c, op, value };
      })
    );
    setPreview(null);
  }, []);

  const updateValue = useCallback(
    (uid: string, value: string | number | boolean | null) => {
      setConditions((prev) =>
        prev.map((c) => (c.uid !== uid ? c : { ...c, value }))
      );
      setPreview(null);
    },
    []
  );

  // ---- build rules object ----

  function buildRules(): AudienceRules {
    return {
      operator,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    conditions: conditions.map(({ uid: _uid, ...c }) => c),
    };
  }

  // ---- preview ----

  async function handlePreview() {
    setPreviewing(true);
    try {
      const res = await fetch('/api/audiences/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: buildRules() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Preview failed');
        return;
      }
      setPreview(data);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setPreviewing(false);
    }
  }

  // ---- save ----

  async function handleSave() {
    if (!name.trim()) {
      toast.error('Please enter a name for this audience');
      return;
    }
    if (conditions.length === 0) {
      toast.error('Add at least one condition');
      return;
    }

    setSaving(true);
    try {
      const url = initialData ? `/api/audiences/${initialData.id}` : '/api/audiences';
      const method = initialData ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, rules: buildRules() }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? 'Save failed');
        return;
      }

      toast.success(initialData ? 'Audience updated' : 'Audience created');
      router.push('/audiences');
      router.refresh();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          {initialData ? 'Edit audience' : 'New audience'}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Define conditions to select which contacts belong to this audience.
        </p>
      </div>

      <div className="flex flex-col gap-8">
        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium text-zinc-700">
            Audience name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lapsed clients, Active members…"
            className="max-w-sm rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>

        {/* Conditions */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-zinc-700">Match</span>
            <OperatorToggle value={operator} onChange={(v) => { setOperator(v); setPreview(null); }} />
            <span className="text-sm text-zinc-500">of the following conditions</span>
          </div>

          <div className="flex flex-col gap-2">
            {conditions.map((cond) => (
              <ConditionRow
                key={cond.uid}
                condition={cond}
                onFieldChange={(f) => updateField(cond.uid, f)}
                onOpChange={(op) => updateOp(cond.uid, op)}
                onValueChange={(v) => updateValue(cond.uid, v)}
                onRemove={() => removeCondition(cond.uid)}
                canRemove={conditions.length > 1}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={addCondition}
            className="self-start rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            + Add condition
          </button>
        </div>

        {/* Preview */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewing || conditions.length === 0}
            className="self-start rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-40"
          >
            {previewing ? 'Calculating…' : 'Preview count'}
          </button>

          {preview !== null && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm font-semibold text-zinc-900">
                {preview.count} contact{preview.count !== 1 ? 's' : ''} match
              </p>
              {preview.sample.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {preview.sample.map((s) => (
                    <li key={s.email} className="text-xs text-zinc-500">
                      {s.name !== s.email ? `${s.name} — ` : ''}{s.email}
                    </li>
                  ))}
                  {preview.count > preview.sample.length && (
                    <li className="text-xs text-zinc-400">
                      …and {preview.count - preview.sample.length} more
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2 border-t border-zinc-200">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving…' : initialData ? 'Save changes' : 'Create audience'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/audiences')}
            className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- sub-components ----

function OperatorToggle({
  value,
  onChange,
}: {
  value: RuleOperator;
  onChange: (v: RuleOperator) => void;
}) {
  return (
    <div className="flex rounded-md border border-zinc-300 overflow-hidden text-sm">
      {(['AND', 'OR'] as RuleOperator[]).map((op) => (
        <button
          key={op}
          type="button"
          onClick={() => onChange(op)}
          className={`px-3 py-1 font-medium transition-colors ${
            value === op
              ? 'bg-zinc-900 text-white'
              : 'bg-white text-zinc-600 hover:bg-zinc-50'
          }`}
        >
          {op}
        </button>
      ))}
    </div>
  );
}

function ConditionRow({
  condition,
  onFieldChange,
  onOpChange,
  onValueChange,
  onRemove,
  canRemove,
}: {
  condition: ConditionRow;
  onFieldChange: (f: string) => void;
  onOpChange: (op: RuleOp) => void;
  onValueChange: (v: string | number | boolean | null) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const fieldDef = AUDIENCE_FIELDS.find((f) => f.value === condition.field);
  const showValue = VALUE_NEEDS_INPUT.includes(condition.op);

  const selectClass =
    'rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900';
  const inputClass =
    'w-32 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Field */}
      <select
        value={condition.field}
        onChange={(e) => onFieldChange(e.target.value)}
        className={selectClass}
      >
        {AUDIENCE_FIELDS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      {/* Op */}
      <select
        value={condition.op}
        onChange={(e) => onOpChange(e.target.value as RuleOp)}
        className={selectClass}
      >
        {(fieldDef?.ops ?? []).map((op) => (
          <option key={op} value={op}>
            {OP_LABELS[op]}
          </option>
        ))}
      </select>

      {/* Value */}
      {showValue && (
        <ValueInput
          fieldDef={fieldDef}
          value={condition.value ?? null}
          onChange={onValueChange}
          inputClass={inputClass}
          selectClass={selectClass}
        />
      )}

      {/* Hint */}
      {fieldDef?.hint && (
        <span className="text-xs text-zinc-400 hidden sm:inline">{fieldDef.hint}</span>
      )}

      {/* Remove */}
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto text-zinc-400 hover:text-red-500 transition-colors text-lg leading-none px-1"
          aria-label="Remove condition"
        >
          ×
        </button>
      )}
    </div>
  );
}

function ValueInput({
  fieldDef,
  value,
  onChange,
  inputClass,
  selectClass,
}: {
  fieldDef: typeof AUDIENCE_FIELDS[number] | undefined;
  op?: RuleOp;
  value: string | number | boolean | null;
  onChange: (v: string | number | boolean | null) => void;
  inputClass: string;
  selectClass: string;
}) {
  if (fieldDef?.type === 'boolean') {
    return (
      <select
        value={String(value ?? true)}
        onChange={(e) => onChange(e.target.value === 'true')}
        className={selectClass}
      >
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }

  if (fieldDef?.type === 'number') {
    return (
      <input
        type="number"
        min={0}
        value={value === null || value === undefined ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        className={inputClass}
      />
    );
  }

  // string
  return (
    <input
      type="text"
      value={value === null || value === undefined ? '' : String(value)}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    />
  );
}

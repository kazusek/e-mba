export type RuleOp = 'eq' | 'not_eq' | 'gte' | 'lte' | 'is_empty' | 'is_not_empty';
export type RuleOperator = 'AND' | 'OR';

export type Condition = {
  field: string;
  op: RuleOp;
  value?: string | number | boolean | null;
};

export type AudienceRules = {
  operator: RuleOperator;
  conditions: Condition[];
};

export type FieldDef = {
  value: string;
  label: string;
  type: 'boolean' | 'number' | 'string';
  ops: RuleOp[];
  hint?: string;
};

export const AUDIENCE_FIELDS: FieldDef[] = [
  {
    value: 'optIn',
    label: 'Email opt-in',
    type: 'boolean',
    ops: ['eq', 'is_empty', 'is_not_empty'],
  },
  {
    value: 'totalVisits',
    label: 'Total visits',
    type: 'number',
    ops: ['gte', 'lte', 'eq', 'is_not_empty'],
  },
  {
    value: 'daysSinceLastVisit',
    label: 'Days since last visit',
    type: 'number',
    ops: ['gte', 'lte', 'is_empty', 'is_not_empty'],
    hint: 'e.g. ≥ 30 to find lapsed clients',
  },
  {
    value: 'membershipName',
    label: 'Membership name',
    type: 'string',
    ops: ['eq', 'not_eq', 'is_empty', 'is_not_empty'],
    hint: 'Exact match, e.g. "Monthly Unlimited"',
  },
  {
    value: 'membershipExpiresDays',
    label: 'Membership expires in (days)',
    type: 'number',
    ops: ['lte', 'gte', 'is_empty', 'is_not_empty'],
    hint: 'e.g. ≤ 7 for expiring soon',
  },
  {
    value: 'joinedDaysAgo',
    label: 'Joined (days ago)',
    type: 'number',
    ops: ['gte', 'lte'],
    hint: 'e.g. ≤ 30 for new clients',
  },
];

export const OP_LABELS: Record<RuleOp, string> = {
  eq: 'is',
  not_eq: 'is not',
  gte: '≥',
  lte: '≤',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
};

/** Returns the default value for a newly-added condition on the given field. */
export function defaultValueForField(fieldValue: string): string | number | boolean | null {
  const def = AUDIENCE_FIELDS.find((f) => f.value === fieldValue);
  if (!def) return null;
  if (def.type === 'boolean') return true;
  if (def.type === 'number') return 1;
  return '';
}

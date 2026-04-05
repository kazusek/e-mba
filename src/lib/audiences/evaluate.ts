import { db } from '@/lib/db';
import { contacts } from '@/lib/db/schema';
import { and, or, eq, gte, lte, ne, isNull, isNotNull, sql, SQL } from 'drizzle-orm';

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

function buildCondition(c: Condition): SQL | null {
  const { field, op, value } = c;

  switch (field) {
    case 'optIn':
      if (op === 'eq') return eq(contacts.optIn, value as boolean);
      if (op === 'is_empty') return isNull(contacts.optIn);
      if (op === 'is_not_empty') return isNotNull(contacts.optIn);
      break;

    case 'totalVisits':
      if (op === 'eq') return eq(contacts.totalVisits, value as number);
      if (op === 'gte') return gte(contacts.totalVisits, value as number);
      if (op === 'lte') return lte(contacts.totalVisits, value as number);
      if (op === 'is_not_empty') return isNotNull(contacts.totalVisits);
      break;

    case 'daysSinceLastVisit':
      if (op === 'gte')
        return sql`(${contacts.lastVisitAt} IS NOT NULL AND date_part('day', NOW() - ${contacts.lastVisitAt}) >= ${value})`;
      if (op === 'lte')
        return sql`(${contacts.lastVisitAt} IS NOT NULL AND date_part('day', NOW() - ${contacts.lastVisitAt}) <= ${value})`;
      if (op === 'is_empty') return isNull(contacts.lastVisitAt);
      if (op === 'is_not_empty') return isNotNull(contacts.lastVisitAt);
      break;

    case 'membershipName':
      if (op === 'eq') return eq(contacts.membershipName, value as string);
      if (op === 'not_eq') return ne(contacts.membershipName, value as string);
      if (op === 'is_empty') return isNull(contacts.membershipName);
      if (op === 'is_not_empty') return isNotNull(contacts.membershipName);
      break;

    case 'membershipExpiresDays':
      if (op === 'lte')
        return sql`(${contacts.membershipEndDate} IS NOT NULL AND date_part('day', ${contacts.membershipEndDate} - NOW()) <= ${value})`;
      if (op === 'gte')
        return sql`(${contacts.membershipEndDate} IS NOT NULL AND date_part('day', ${contacts.membershipEndDate} - NOW()) >= ${value})`;
      if (op === 'is_empty') return isNull(contacts.membershipEndDate);
      if (op === 'is_not_empty') return isNotNull(contacts.membershipEndDate);
      break;

    case 'joinedDaysAgo':
      if (op === 'gte')
        return sql`(${contacts.joinedAt} IS NOT NULL AND date_part('day', NOW() - ${contacts.joinedAt}) >= ${value})`;
      if (op === 'lte')
        return sql`(${contacts.joinedAt} IS NOT NULL AND date_part('day', NOW() - ${contacts.joinedAt}) <= ${value})`;
      break;
  }

  return null;
}

export async function evaluateAudience(rules: AudienceRules): Promise<{
  rows: { id: string; email: string; firstName: string | null; lastName: string | null }[];
  count: number;
}> {
  if (!rules.conditions?.length) return { rows: [], count: 0 };

  const clauses = rules.conditions
    .map(buildCondition)
    .filter((c): c is SQL => c !== null);

  if (!clauses.length) return { rows: [], count: 0 };

  const where = rules.operator === 'AND' ? and(...clauses) : or(...clauses);

  const rows = await db
    .select({
      id: contacts.id,
      email: contacts.email,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
    })
    .from(contacts)
    .where(where);

  return { rows, count: rows.length };
}

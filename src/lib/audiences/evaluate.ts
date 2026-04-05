import { db } from '@/lib/db';
import { contacts } from '@/lib/db/schema';
import { and, or, eq, gte, lte, ne, isNull, isNotNull, sql, SQL } from 'drizzle-orm';
import type { RuleOp, RuleOperator, Condition, AudienceRules } from './fields';

export type { RuleOp, RuleOperator, Condition, AudienceRules };
export type { FieldDef } from './fields';
export { AUDIENCE_FIELDS, OP_LABELS, defaultValueForField } from './fields';

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

    case 'listTag':
      if (op === 'contains') return sql`(${contacts.listTags} @> ARRAY[${value}]::text[])`;
      if (op === 'not_contains') return sql`(${contacts.listTags} IS NULL OR NOT (${contacts.listTags} @> ARRAY[${value}]::text[]))`;
      if (op === 'is_empty') return sql`(${contacts.listTags} IS NULL OR ${contacts.listTags} = '{}')`;
      if (op === 'is_not_empty') return sql`(${contacts.listTags} IS NOT NULL AND ${contacts.listTags} != '{}')`;
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

  const archivedFilter = eq(contacts.archived, false);
  const where = rules.operator === 'AND'
    ? and(archivedFilter, ...clauses)
    : and(archivedFilter, or(...clauses));

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

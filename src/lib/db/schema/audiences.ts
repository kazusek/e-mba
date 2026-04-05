import { pgTable, uuid, varchar, jsonb, integer, timestamp } from 'drizzle-orm/pg-core';

// Rules shape stored in the `rules` jsonb column:
// {
//   operator: 'AND' | 'OR',
//   conditions: [
//     { field: 'totalVisits', op: 'gte', value: 5 },
//     { field: 'daysSinceLastVisit', op: 'gte', value: 30 },
//     { field: 'membershipName', op: 'eq', value: 'Monthly' },
//     { field: 'optIn', op: 'eq', value: true },
//   ]
// }
export const audiences = pgTable('audiences', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  rules: jsonb('rules').notNull(),
  contactCount: integer('contact_count'),
  lastCalculatedAt: timestamp('last_calculated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const importTypeEnum = pgEnum('import_type', [
  'new_clients',
  'active_memberships',
  'lapsed_clients',
  'frequent_clients',
  'client_credit',
  'sales_by_transaction',
  'user_events',
  'membership_late_cancel',
  'class_popularity',
  'location_popularity',
  'instructor_report',
  'promo_performance',
]);

export const importStatusEnum = pgEnum('import_status', [
  'pending',
  'processing',
  'completed',
  'failed',
]);

export const csvImports = pgTable('csv_imports', {
  id: uuid('id').defaultRandom().primaryKey(),
  filename: varchar('filename', { length: 255 }).notNull(),
  importType: importTypeEnum('import_type').notNull(),
  rowCount: integer('row_count'),
  status: importStatusEnum('status').default('pending').notNull(),
  errorMessage: text('error_message'),
  importedAt: timestamp('imported_at', { withTimezone: true }).defaultNow().notNull(),
});

// One row per contact (upserted by email). Columns are populated from whichever
// Instabook reports have been imported — fields may be null if that report hasn't run.
export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    firstName: varchar('first_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }),
    // From New Clients / Active Memberships
    optIn: boolean('opt_in'),
    joinedAt: timestamp('joined_at', { withTimezone: true }),
    // From Lapsed Clients / Frequent Clients
    lastVisitAt: timestamp('last_visit_at', { withTimezone: true }),
    totalVisits: integer('total_visits'),
    // From Active Memberships
    membershipName: varchar('membership_name', { length: 255 }),
    membershipStartDate: timestamp('membership_start_date', { withTimezone: true }),
    membershipEndDate: timestamp('membership_end_date', { withTimezone: true }),
    // Which import lists this contact has appeared in (accumulates across imports)
    listTags: text('list_tags').array(),
    // Archived contacts are excluded from audience evaluation but kept in the DB
    archived: boolean('archived').default(false).notNull(),
    importedAt: timestamp('imported_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('contacts_email_idx').on(table.email),
    index('contacts_last_visit_idx').on(table.lastVisitAt),
    index('contacts_membership_end_idx').on(table.membershipEndDate),
    index('contacts_opt_in_idx').on(table.optIn),
  ]
);

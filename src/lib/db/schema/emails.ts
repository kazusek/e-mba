import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  jsonb,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { contacts } from './contacts';
import { audiences } from './audiences';

export const automationTriggerEventEnum = pgEnum('automation_trigger_event', [
  'new_client',       // fired when a contact appears for the first time in an import
  'lapsed_client',    // fired by cron when daysSinceLastVisit >= lapsedDays
  'membership_expiring', // fired by cron when membershipEndDate is within N days
]);

export const automationDelayUnitEnum = pgEnum('automation_delay_unit', [
  'minutes',
  'hours',
  'days',
]);

export const emailCampaignStatusEnum = pgEnum('email_campaign_status', [
  'draft',
  'sending',
  'sent',
  'failed',
]);

export const emailSendLogStatusEnum = pgEnum('email_send_log_status', [
  'pending',
  'sent',
  'failed',
  'skipped',
]);

export const emailTemplates = pgTable('email_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 500 }).notNull(),
  designJson: jsonb('design_json'),
  bodyHtml: text('body_html'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const emailAutomations = pgTable(
  'email_automations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    isActive: boolean('is_active').default(false).notNull(),
    triggerEvent: automationTriggerEventEnum('trigger_event').notNull(),
    templateId: uuid('template_id').references(() => emailTemplates.id, { onDelete: 'set null' }),
    delayAmount: integer('delay_amount').default(0).notNull(),
    delayUnit: automationDelayUnitEnum('delay_unit').default('hours').notNull(),
    // For lapsed_client: days of inactivity before triggering
    lapsedDays: integer('lapsed_days'),
    // For membership_expiring: days before end date to trigger
    expiryWarningDays: integer('expiry_warning_days'),
    // Min days between sends to the same contact
    cooldownDays: integer('cooldown_days').default(30).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('email_automations_trigger_event_idx').on(table.triggerEvent),
    index('email_automations_active_idx').on(table.isActive),
  ]
);

export const emailCampaigns = pgTable(
  'email_campaigns',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    templateId: uuid('template_id').references(() => emailTemplates.id, { onDelete: 'set null' }),
    audienceId: uuid('audience_id').references(() => audiences.id, { onDelete: 'set null' }),
    status: emailCampaignStatusEnum('status').default('draft').notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    recipientCount: integer('recipient_count'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('email_campaigns_status_idx').on(table.status),
  ]
);

export const emailSendLogs = pgTable(
  'email_send_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    automationId: uuid('automation_id').references(() => emailAutomations.id, { onDelete: 'set null' }),
    campaignId: uuid('campaign_id').references(() => emailCampaigns.id, { onDelete: 'set null' }),
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'cascade' }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    status: emailSendLogStatusEnum('status').default('pending').notNull(),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('email_send_logs_status_scheduled_idx').on(table.status, table.scheduledAt),
    index('email_send_logs_automation_contact_idx').on(table.automationId, table.contactId),
    index('email_send_logs_campaign_contact_idx').on(table.campaignId, table.contactId),
  ]
);

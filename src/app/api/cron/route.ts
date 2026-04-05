import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  emailSendLogs,
  emailAutomations,
  emailCampaigns,
  emailTemplates,
  contacts,
} from '@/lib/db/schema';
import { and, eq, gte, lte, isNotNull, sql } from 'drizzle-orm';
import { sendWithTemplate } from '@/lib/email/notify';

function delayToMs(amount: number, unit: string): number {
  switch (unit) {
    case 'minutes': return amount * 60 * 1000;
    case 'hours':   return amount * 60 * 60 * 1000;
    case 'days':    return amount * 24 * 60 * 60 * 1000;
    default:        return 0;
  }
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret = dev mode
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

async function getTemplateId(log: typeof emailSendLogs.$inferSelect): Promise<string | null> {
  if (log.automationId) {
    const [row] = await db
      .select({ templateId: emailAutomations.templateId })
      .from(emailAutomations)
      .where(eq(emailAutomations.id, log.automationId));
    return row?.templateId ?? null;
  }
  if (log.campaignId) {
    const [row] = await db
      .select({ templateId: emailCampaigns.templateId })
      .from(emailCampaigns)
      .where(eq(emailCampaigns.id, log.campaignId));
    return row?.templateId ?? null;
  }
  return null;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = { pendingSent: 0, pendingFailed: 0, lapsedQueued: 0, expiryQueued: 0 };

  // ─── Job 1: Process due pending send logs ────────────────────────────────────
  const pendingLogs = await db
    .select()
    .from(emailSendLogs)
    .where(and(eq(emailSendLogs.status, 'pending'), lte(emailSendLogs.scheduledAt, new Date())))
    .limit(100);

  for (const log of pendingLogs) {
    const templateId = await getTemplateId(log);
    if (!templateId) {
      await db
        .update(emailSendLogs)
        .set({ status: 'skipped', sentAt: new Date() })
        .where(eq(emailSendLogs.id, log.id));
      continue;
    }

    const [template] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, templateId));

    if (!template?.bodyHtml) {
      await db
        .update(emailSendLogs)
        .set({ status: 'skipped', sentAt: new Date() })
        .where(eq(emailSendLogs.id, log.id));
      continue;
    }

    const [contact] = await db
      .select({ firstName: contacts.firstName, lastName: contacts.lastName })
      .from(contacts)
      .where(eq(contacts.id, log.contactId));

    const result = await sendWithTemplate({
      template,
      to: log.email,
      vars: {
        firstName: contact?.firstName ?? '',
        lastName: contact?.lastName ?? '',
        email: log.email,
      },
    });

    await db
      .update(emailSendLogs)
      .set({
        status: result.success ? 'sent' : 'failed',
        sentAt: new Date(),
        errorMessage: result.success ? null : 'Send failed',
      })
      .where(eq(emailSendLogs.id, log.id));

    if (result.success) results.pendingSent++;
    else results.pendingFailed++;
  }

  // ─── Job 2: Queue lapsed_client automations ───────────────────────────────────
  const lapsedAutomations = await db
    .select()
    .from(emailAutomations)
    .where(
      and(
        eq(emailAutomations.triggerEvent, 'lapsed_client'),
        eq(emailAutomations.isActive, true),
        isNotNull(emailAutomations.lapsedDays)
      )
    );

  for (const automation of lapsedAutomations) {
    const lapsedDays = automation.lapsedDays!;
    const lapsedContacts = await db
      .select({ id: contacts.id, email: contacts.email, firstName: contacts.firstName, lastName: contacts.lastName })
      .from(contacts)
      .where(sql`${contacts.lastVisitAt} IS NOT NULL AND date_part('day', NOW() - ${contacts.lastVisitAt}) >= ${lapsedDays}`);

    for (const contact of lapsedContacts) {
      const cooldownCutoff = new Date(Date.now() - automation.cooldownDays * 86400000);
      const [existing] = await db
        .select({ id: emailSendLogs.id })
        .from(emailSendLogs)
        .where(and(
          eq(emailSendLogs.automationId, automation.id),
          eq(emailSendLogs.contactId, contact.id),
          gte(emailSendLogs.createdAt, cooldownCutoff)
        ));

      if (!existing) {
        await db.insert(emailSendLogs).values({
          automationId: automation.id,
          contactId: contact.id,
          email: contact.email,
          scheduledAt: new Date(Date.now() + delayToMs(automation.delayAmount, automation.delayUnit)),
          status: 'pending',
        });
        results.lapsedQueued++;
      }
    }
  }

  // ─── Job 3: Queue membership_expiring automations ─────────────────────────────
  const expiryAutomations = await db
    .select()
    .from(emailAutomations)
    .where(
      and(
        eq(emailAutomations.triggerEvent, 'membership_expiring'),
        eq(emailAutomations.isActive, true),
        isNotNull(emailAutomations.expiryWarningDays)
      )
    );

  for (const automation of expiryAutomations) {
    const warningDays = automation.expiryWarningDays!;
    const expiringContacts = await db
      .select({ id: contacts.id, email: contacts.email, firstName: contacts.firstName, lastName: contacts.lastName })
      .from(contacts)
      .where(
        sql`${contacts.membershipEndDate} IS NOT NULL
          AND date_part('day', ${contacts.membershipEndDate} - NOW()) <= ${warningDays}
          AND date_part('day', ${contacts.membershipEndDate} - NOW()) >= 0`
      );

    for (const contact of expiringContacts) {
      const cooldownCutoff = new Date(Date.now() - automation.cooldownDays * 86400000);
      const [existing] = await db
        .select({ id: emailSendLogs.id })
        .from(emailSendLogs)
        .where(and(
          eq(emailSendLogs.automationId, automation.id),
          eq(emailSendLogs.contactId, contact.id),
          gte(emailSendLogs.createdAt, cooldownCutoff)
        ));

      if (!existing) {
        await db.insert(emailSendLogs).values({
          automationId: automation.id,
          contactId: contact.id,
          email: contact.email,
          scheduledAt: new Date(Date.now() + delayToMs(automation.delayAmount, automation.delayUnit)),
          status: 'pending',
        });
        results.expiryQueued++;
      }
    }
  }

  return NextResponse.json({ success: true, ...results });
}

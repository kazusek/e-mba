import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { and, eq, gte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { contacts, csvImports, emailAutomations, emailSendLogs } from '@/lib/db/schema';
import { parseRows, SUPPORTED_IMPORT_TYPES } from '@/lib/csv/parsers';
import type { importTypeEnum } from '@/lib/db/schema';

function delayToMs(amount: number, unit: string): number {
  switch (unit) {
    case 'minutes': return amount * 60 * 1000;
    case 'hours':   return amount * 60 * 60 * 1000;
    case 'days':    return amount * 24 * 60 * 60 * 1000;
    default:        return 0;
  }
}

type ImportType = (typeof importTypeEnum.enumValues)[number];

const SUPPORTED_VALUES = new Set(SUPPORTED_IMPORT_TYPES.map((t) => t.value));

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const importType = formData.get('importType') as string | null;

  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  if (!importType) return NextResponse.json({ error: 'No report type selected' }, { status: 400 });
  if (!SUPPORTED_VALUES.has(importType as ImportType)) {
    return NextResponse.json({ error: `Unsupported report type: ${importType}` }, { status: 400 });
  }

  const text = await file.text();
  const { data, errors: parseErrors } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parseErrors.length > 0 && data.length === 0) {
    return NextResponse.json({ error: 'Could not parse CSV file' }, { status: 400 });
  }

  // Create import record
  const [importRecord] = await db
    .insert(csvImports)
    .values({
      filename: file.name,
      importType: importType as ImportType,
      rowCount: data.length,
      status: 'processing',
    })
    .returning();

  const { contacts: parsedContacts, skipped } = parseRows(importType as ImportType, data);

  let upserted = 0;
  const errors: string[] = [];
  const batchStart = new Date();

  for (const contact of parsedContacts) {
    try {
      const now = new Date();

      // Build the update set — only include fields present in this contact record
      // so we don't overwrite data from a previous import with nulls
      const updateSet: Record<string, unknown> = { updatedAt: now };
      if (contact.firstName !== undefined) updateSet.firstName = contact.firstName;
      if (contact.lastName !== undefined) updateSet.lastName = contact.lastName;
      if (contact.optIn !== undefined) updateSet.optIn = contact.optIn;
      if (contact.joinedAt !== undefined) updateSet.joinedAt = contact.joinedAt;
      if (contact.lastVisitAt !== undefined) updateSet.lastVisitAt = contact.lastVisitAt;
      if (contact.totalVisits !== undefined) updateSet.totalVisits = contact.totalVisits;
      if (contact.membershipName !== undefined) updateSet.membershipName = contact.membershipName;
      if (contact.membershipStartDate !== undefined) updateSet.membershipStartDate = contact.membershipStartDate;
      if (contact.membershipEndDate !== undefined) updateSet.membershipEndDate = contact.membershipEndDate;

      await db
        .insert(contacts)
        .values({ ...contact, importedAt: now, updatedAt: now })
        .onConflictDoUpdate({
          target: contacts.email,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          set: updateSet as any,
        });

      upserted++;
    } catch (err) {
      errors.push(`${contact.email}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await db
    .update(csvImports)
    .set({ status: errors.length === parsedContacts.length && parsedContacts.length > 0 ? 'failed' : 'completed' })
    .where(eq(csvImports.id, importRecord.id));

  // Fire new_client automations for contacts created in this batch
  // (importedAt is only set on initial insert, not updated on conflict)
  try {
    const newContacts = await db
      .select({ id: contacts.id, email: contacts.email, firstName: contacts.firstName, lastName: contacts.lastName })
      .from(contacts)
      .where(gte(contacts.importedAt, batchStart));

    if (newContacts.length > 0) {
      const newClientAutomations = await db
        .select()
        .from(emailAutomations)
        .where(and(eq(emailAutomations.triggerEvent, 'new_client'), eq(emailAutomations.isActive, true)));

      for (const automation of newClientAutomations) {
        for (const contact of newContacts) {
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
          }
        }
      }
    }
  } catch (err) {
    // Don't fail the import if automation queuing fails — just log it
    console.error('[import] Failed to queue new_client automations:', err);
  }

  return NextResponse.json({
    success: true,
    total: data.length,
    upserted,
    skipped,
    errors: errors.slice(0, 20),
  });
}

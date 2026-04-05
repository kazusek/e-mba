import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { emailAutomations, emailTemplates } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  triggerEvent: z.enum(['new_client', 'lapsed_client', 'membership_expiring']),
  templateId: z.string().uuid(),
  delayAmount: z.number().int().min(0).default(0),
  delayUnit: z.enum(['minutes', 'hours', 'days']).default('hours'),
  lapsedDays: z.number().int().min(1).optional().nullable(),
  expiryWarningDays: z.number().int().min(1).optional().nullable(),
  cooldownDays: z.number().int().min(0).default(30),
  isActive: z.boolean().default(false),
});

export async function GET() {
  const rows = await db
    .select({
      id: emailAutomations.id,
      name: emailAutomations.name,
      isActive: emailAutomations.isActive,
      triggerEvent: emailAutomations.triggerEvent,
      delayAmount: emailAutomations.delayAmount,
      delayUnit: emailAutomations.delayUnit,
      lapsedDays: emailAutomations.lapsedDays,
      expiryWarningDays: emailAutomations.expiryWarningDays,
      cooldownDays: emailAutomations.cooldownDays,
      templateId: emailAutomations.templateId,
      createdAt: emailAutomations.createdAt,
      templateName: emailTemplates.name,
    })
    .from(emailAutomations)
    .leftJoin(emailTemplates, eq(emailAutomations.templateId, emailTemplates.id))
    .orderBy(desc(emailAutomations.createdAt));

  return NextResponse.json({ automations: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
  }

  const [automation] = await db
    .insert(emailAutomations)
    .values(parsed.data)
    .returning();

  return NextResponse.json({ automation }, { status: 201 });
}

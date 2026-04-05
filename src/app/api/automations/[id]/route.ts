import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { emailAutomations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  triggerEvent: z.enum(['new_client', 'lapsed_client', 'membership_expiring']).optional(),
  templateId: z.string().uuid().optional(),
  delayAmount: z.number().int().min(0).optional(),
  delayUnit: z.enum(['minutes', 'hours', 'days']).optional(),
  lapsedDays: z.number().int().min(1).nullable().optional(),
  expiryWarningDays: z.number().int().min(1).nullable().optional(),
  cooldownDays: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const [automation] = await db
    .update(emailAutomations)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(emailAutomations.id, id))
    .returning();

  if (!automation) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ automation });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [deleted] = await db
    .delete(emailAutomations)
    .where(eq(emailAutomations.id, id))
    .returning({ id: emailAutomations.id });

  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ success: true });
}

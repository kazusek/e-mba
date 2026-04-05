import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { audiences } from '@/lib/db/schema';
import { evaluateAudience } from '@/lib/audiences/evaluate';
import type { AudienceRules } from '@/lib/audiences/evaluate';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const [audience] = await db.select().from(audiences).where(eq(audiences.id, id)).limit(1);
  if (!audience) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(audience);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;

  let body: { name: string; rules: AudienceRules };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, rules } = body;
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (!rules?.conditions?.length)
    return NextResponse.json({ error: 'At least one condition is required' }, { status: 400 });

  const { count } = await evaluateAudience(rules);

  const [updated] = await db
    .update(audiences)
    .set({
      name: name.trim(),
      rules,
      contactCount: count,
      lastCalculatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(audiences.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await db.delete(audiences).where(eq(audiences.id, id));
  return new NextResponse(null, { status: 204 });
}

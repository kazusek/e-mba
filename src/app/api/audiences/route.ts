import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { audiences } from '@/lib/db/schema';
import { evaluateAudience } from '@/lib/audiences/evaluate';
import type { AudienceRules } from '@/lib/audiences/evaluate';

export async function GET() {
  const rows = await db
    .select()
    .from(audiences)
    .orderBy(desc(audiences.createdAt));

  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
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

  // Evaluate to get initial count
  const { count } = await evaluateAudience(rules);

  const [audience] = await db
    .insert(audiences)
    .values({
      name: name.trim(),
      rules,
      contactCount: count,
      lastCalculatedAt: new Date(),
    })
    .returning();

  return NextResponse.json(audience, { status: 201 });
}

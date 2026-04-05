import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { emailTemplates } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  subject: z.string().min(1).max(500),
  designJson: z.record(z.string(), z.unknown()).nullable().optional(),
  bodyHtml: z.string().nullable().optional(),
});

export async function GET() {
  const rows = await db
    .select()
    .from(emailTemplates)
    .orderBy(desc(emailTemplates.createdAt));

  return NextResponse.json({ templates: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { name, subject, designJson, bodyHtml } = parsed.data;

  const [template] = await db
    .insert(emailTemplates)
    .values({
      name,
      subject,
      designJson: designJson ?? null,
      bodyHtml: bodyHtml ?? null,
    })
    .returning();

  return NextResponse.json({ template }, { status: 201 });
}

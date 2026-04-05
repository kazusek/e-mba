import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { contacts } from '@/lib/db/schema';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await db.delete(contacts).where(eq(contacts.id, id));
  return new NextResponse(null, { status: 204 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const archived = typeof body.archived === 'boolean' ? body.archived : null;

  if (archived === null) {
    return NextResponse.json({ error: 'archived (boolean) is required' }, { status: 400 });
  }

  const [updated] = await db
    .update(contacts)
    .set({ archived, updatedAt: new Date() })
    .where(eq(contacts.id, id))
    .returning({ id: contacts.id });

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(updated);
}

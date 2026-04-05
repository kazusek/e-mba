import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { contacts } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    const count = await db.select({ count: sql<number>`count(*)` }).from(contacts);
    const sample = await db.select({ id: contacts.id, email: contacts.email, firstName: contacts.firstName }).from(contacts).limit(5);
    return NextResponse.json({ count: count[0].count, sample, dbUrl: process.env.DATABASE_URL?.slice(0, 30) + '...' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

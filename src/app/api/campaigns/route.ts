import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { emailCampaigns, emailTemplates, audiences } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  templateId: z.string().uuid(),
  audienceId: z.string().uuid(),
});

export async function GET() {
  const rows = await db
    .select({
      id: emailCampaigns.id,
      name: emailCampaigns.name,
      status: emailCampaigns.status,
      recipientCount: emailCampaigns.recipientCount,
      sentAt: emailCampaigns.sentAt,
      createdAt: emailCampaigns.createdAt,
      templateId: emailCampaigns.templateId,
      audienceId: emailCampaigns.audienceId,
      templateName: emailTemplates.name,
      audienceName: audiences.name,
    })
    .from(emailCampaigns)
    .leftJoin(emailTemplates, eq(emailCampaigns.templateId, emailTemplates.id))
    .leftJoin(audiences, eq(emailCampaigns.audienceId, audiences.id))
    .orderBy(desc(emailCampaigns.createdAt));

  return NextResponse.json({ campaigns: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const [campaign] = await db
    .insert(emailCampaigns)
    .values({
      name: parsed.data.name,
      templateId: parsed.data.templateId,
      audienceId: parsed.data.audienceId,
      status: 'draft',
    })
    .returning();

  return NextResponse.json({ campaign }, { status: 201 });
}

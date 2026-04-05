import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { emailCampaigns, emailTemplates, audiences, emailSendLogs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { evaluateAudience } from '@/lib/audiences/evaluate';
import type { AudienceRules } from '@/lib/audiences/evaluate';
import { sendWithTemplate } from '@/lib/email/notify';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [campaign] = await db
    .select()
    .from(emailCampaigns)
    .where(eq(emailCampaigns.id, id));

  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (campaign.status !== 'draft') {
    return NextResponse.json({ error: 'Campaign has already been sent' }, { status: 409 });
  }
  if (!campaign.templateId) {
    return NextResponse.json({ error: 'Campaign has no template' }, { status: 400 });
  }
  if (!campaign.audienceId) {
    return NextResponse.json({ error: 'Campaign has no audience' }, { status: 400 });
  }

  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.id, campaign.templateId));

  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  if (!template.bodyHtml) {
    return NextResponse.json({ error: 'Template has no HTML — open it in the editor first' }, { status: 400 });
  }

  const [audience] = await db
    .select()
    .from(audiences)
    .where(eq(audiences.id, campaign.audienceId));

  if (!audience) return NextResponse.json({ error: 'Audience not found' }, { status: 404 });

  const { rows: contacts } = await evaluateAudience(audience.rules as AudienceRules);

  // Mark campaign as sending
  await db
    .update(emailCampaigns)
    .set({ status: 'sending', recipientCount: contacts.length, updatedAt: new Date() })
    .where(eq(emailCampaigns.id, id));

  let sent = 0;
  let failed = 0;
  const now = new Date();

  for (const contact of contacts) {
    const vars = {
      firstName: contact.firstName ?? '',
      lastName: contact.lastName ?? '',
      email: contact.email,
    };
    const result = await sendWithTemplate({ template, to: contact.email, vars });
    const sentAt = result.success ? now : undefined;

    await db.insert(emailSendLogs).values({
      campaignId: campaign.id,
      contactId: contact.id,
      email: contact.email,
      scheduledAt: now,
      sentAt: sentAt ?? null,
      status: result.success ? 'sent' : 'failed',
    });

    if (result.success) sent++;
    else failed++;
  }

  await db
    .update(emailCampaigns)
    .set({ status: 'sent', sentAt: now, updatedAt: new Date() })
    .where(eq(emailCampaigns.id, id));

  return NextResponse.json({ success: true, sent, failed, total: contacts.length });
}

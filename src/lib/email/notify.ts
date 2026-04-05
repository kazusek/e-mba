import { Resend } from 'resend';
import { renderEmailHtml, renderSubject } from './renderer';
import { emailTemplates } from '@/lib/db/schema';

type EmailTemplateRow = typeof emailTemplates.$inferSelect;

/**
 * Send an email using a pre-fetched template object.
 * Used by the campaign and automation send systems.
 */
export async function sendWithTemplate({
  template,
  to,
  vars,
}: {
  template: EmailTemplateRow;
  to: string;
  vars: Record<string, string>;
}): Promise<{ success: boolean }> {
  if (!template.bodyHtml) {
    console.log(`[email] Template "${template.name}" has no HTML body — open in editor to design it`);
    return { success: false };
  }

  const subject = renderSubject(template.subject, vars);
  const html = renderEmailHtml(template.bodyHtml, vars);

  return sendEmail({ to, subject, html });
}

/**
 * Low-level send via Resend. Falls back to console.log in dev (no API key).
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const fromName = process.env.RESEND_FROM_NAME ?? 'Studio';

  if (!apiKey || !fromEmail) {
    console.log(`[email] To: ${to} | Subject: ${subject}`);
    console.log(`[email] HTML length: ${html.length} chars (no Resend key configured — dev mode)`);
    return { success: true };
  }

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      html,
    });
    return { success: true };
  } catch (error) {
    console.error(`[email] Failed to send to ${to}:`, error);
    return { success: false };
  }
}

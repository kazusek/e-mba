import { NextRequest, NextResponse } from 'next/server';
import { evaluateAudience } from '@/lib/audiences/evaluate';
import type { AudienceRules } from '@/lib/audiences/evaluate';

export async function POST(request: NextRequest) {
  let body: { rules: AudienceRules };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { rules } = body;
  if (!rules?.conditions?.length) {
    return NextResponse.json({ count: 0, sample: [] });
  }

  const { rows, count } = await evaluateAudience(rules);

  // Return up to 5 sample contacts for the preview panel
  const sample = rows.slice(0, 5).map((r) => ({
    email: r.email,
    name: [r.firstName, r.lastName].filter(Boolean).join(' ') || r.email,
  }));

  return NextResponse.json({ count, sample });
}

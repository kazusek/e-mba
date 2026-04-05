import { db } from '@/lib/db';
import { audiences } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import AudienceBuilderForm from '@/components/audience-builder-form';
import type { AudienceRules } from '@/lib/audiences/evaluate';

export default async function EditAudiencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [audience] = await db
    .select()
    .from(audiences)
    .where(eq(audiences.id, id))
    .limit(1);

  if (!audience) notFound();

  return (
    <AudienceBuilderForm
      initialData={{
        id: audience.id,
        name: audience.name,
        rules: audience.rules as AudienceRules,
      }}
    />
  );
}

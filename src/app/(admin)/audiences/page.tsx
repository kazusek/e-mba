import { db } from '@/lib/db';
import { audiences } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import Link from 'next/link';
import { DeleteAudienceButton } from '@/components/delete-audience-button';

function formatDate(d: Date | null) {
  if (!d) return 'never';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(d)
  );
}

export default async function AudiencesPage() {
  const rows = await db.select().from(audiences).orderBy(desc(audiences.createdAt));

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Audiences</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Rule-based contact segments for campaigns and automations.
          </p>
        </div>
        <Link
          href="/audiences/new"
          className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          New audience
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-6 py-16 text-center">
          <p className="text-sm font-medium text-zinc-700">No audiences yet</p>
          <p className="mt-1 text-sm text-zinc-400">
            Create an audience to start segmenting your contacts.
          </p>
          <Link
            href="/audiences/new"
            className="mt-4 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            New audience
          </Link>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white overflow-hidden">
          {rows.map((audience) => (
            <div
              key={audience.id}
              className="flex items-center justify-between gap-4 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-900 truncate">{audience.name}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {audience.contactCount !== null
                    ? `${audience.contactCount} contacts`
                    : 'not yet calculated'}
                  {' · '}
                  last calculated {formatDate(audience.lastCalculatedAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/audiences/${audience.id}/edit`}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  Edit
                </Link>
                <DeleteAudienceButton id={audience.id} name={audience.name} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

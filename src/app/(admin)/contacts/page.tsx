export const dynamic = 'force-dynamic';

import { unstable_noStore as noStore } from 'next/cache';
import { db } from '@/lib/db';
import { contacts } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { LIST_TAG_LABELS } from '@/lib/audiences/fields';
import { ContactActions } from '@/components/contact-actions';

function fmt(d: Date | null, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-GB', opts ?? { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d));
}

const TAG_COLOURS: Record<string, string> = {
  new_clients: 'bg-blue-100 text-blue-700',
  lapsed_clients: 'bg-amber-100 text-amber-700',
  active_memberships: 'bg-green-100 text-green-700',
  frequent_clients: 'bg-purple-100 text-purple-700',
  client_credit: 'bg-zinc-100 text-zinc-600',
};

export default async function ContactsPage() {
  noStore();
  const rows = await db
    .select()
    .from(contacts)
    .orderBy(desc(contacts.importedAt))
    .limit(500);

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Contacts</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {rows.length === 500 ? 'Showing most recent 500 contacts.' : `${rows.length} contact${rows.length === 1 ? '' : 's'} imported.`}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-6 py-16 text-center">
          <p className="text-sm font-medium text-zinc-700">No contacts yet</p>
          <p className="mt-1 text-sm text-zinc-400">Import a CSV from the Import Data page to populate contacts.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="min-w-full text-sm divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                {['Name', 'Email', 'Source', 'Opt-in', 'Visits', 'Last visit', 'Membership', 'Joined', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-zinc-100">
              {rows.map((c) => {
                const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email;
                return (
                  <tr key={c.id} className={c.archived ? 'opacity-50' : 'hover:bg-zinc-50'}>
                    <td className="px-4 py-3 font-medium text-zinc-900 whitespace-nowrap">
                      {name !== c.email ? name : '—'}
                      {c.archived && (
                        <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">Archived</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{c.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {c.listTags && c.listTags.length > 0 ? (
                          c.listTags.map((tag) => (
                            <span
                              key={tag}
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${TAG_COLOURS[tag] ?? 'bg-zinc-100 text-zinc-600'}`}
                            >
                              {LIST_TAG_LABELS[tag] ?? tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {c.optIn === null ? (
                        <span className="text-zinc-300">—</span>
                      ) : c.optIn ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Yes</span>
                      ) : (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{c.totalVisits ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{fmt(c.lastVisitAt)}</td>
                    <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                      {c.membershipName ?? <span className="text-zinc-300">—</span>}
                      {c.membershipEndDate && (
                        <span className="ml-1 text-xs text-zinc-400">until {fmt(c.membershipEndDate)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{fmt(c.joinedAt)}</td>
                    <td className="px-4 py-3">
                      <ContactActions id={c.id} name={name} archived={c.archived} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

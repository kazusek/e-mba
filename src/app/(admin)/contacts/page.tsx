export const dynamic = 'force-dynamic';

import { db } from '@/lib/db';
import { contacts } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

function fmt(d: Date | null, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-GB', opts ?? { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d));
}

export default async function ContactsPage() {
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
                {['Name', 'Email', 'Opt-in', 'Visits', 'Last visit', 'Membership', 'Joined'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-zinc-100">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-900 whitespace-nowrap">
                    {[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{c.email}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

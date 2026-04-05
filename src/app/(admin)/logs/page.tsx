export const dynamic = 'force-dynamic';

import { unstable_noStore as noStore } from 'next/cache';
import { db } from '@/lib/db';
import { emailSendLogs, emailAutomations, emailCampaigns } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  sent: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  skipped: 'bg-zinc-100 text-zinc-500',
};

function fmt(d: Date | null) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(d));
}

export default async function LogsPage() {
  noStore();
  const rows = await db
    .select({
      id: emailSendLogs.id,
      email: emailSendLogs.email,
      status: emailSendLogs.status,
      scheduledAt: emailSendLogs.scheduledAt,
      sentAt: emailSendLogs.sentAt,
      errorMessage: emailSendLogs.errorMessage,
      createdAt: emailSendLogs.createdAt,
      automationName: emailAutomations.name,
      campaignName: emailCampaigns.name,
    })
    .from(emailSendLogs)
    .leftJoin(emailAutomations, eq(emailSendLogs.automationId, emailAutomations.id))
    .leftJoin(emailCampaigns, eq(emailSendLogs.campaignId, emailCampaigns.id))
    .orderBy(desc(emailSendLogs.createdAt))
    .limit(200);

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Send Logs</h1>
        <p className="mt-1 text-sm text-zinc-500">Most recent 200 email send records.</p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-6 py-16 text-center">
          <p className="text-sm font-medium text-zinc-700">No send logs yet</p>
          <p className="mt-1 text-sm text-zinc-400">Logs appear here once campaigns or automations send emails.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="min-w-full text-sm divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                {['Contact', 'Source', 'Status', 'Scheduled', 'Sent'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-zinc-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 text-zinc-900 whitespace-nowrap">{row.email}</td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                    {row.automationName
                      ? <><span className="text-zinc-400 text-xs mr-1">auto</span>{row.automationName}</>
                      : row.campaignName
                      ? <><span className="text-zinc-400 text-xs mr-1">campaign</span>{row.campaignName}</>
                      : <span className="text-zinc-300">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[row.status] ?? ''}`}>
                      {row.status}
                    </span>
                    {row.errorMessage && (
                      <span className="ml-2 text-xs text-red-500 truncate max-w-xs inline-block align-middle" title={row.errorMessage}>
                        {row.errorMessage}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap text-xs">{fmt(row.scheduledAt)}</td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap text-xs">{fmt(row.sentAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

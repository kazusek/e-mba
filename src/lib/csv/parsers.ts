import type { importTypeEnum } from '@/lib/db/schema';

type ImportType = (typeof importTypeEnum.enumValues)[number];

export type ContactUpsert = {
  email: string;
  firstName?: string;
  lastName?: string;
  optIn?: boolean;
  joinedAt?: Date;
  lastVisitAt?: Date;
  totalVisits?: number;
  membershipName?: string;
  membershipStartDate?: Date;
  membershipEndDate?: Date;
};

// The report types that have contact-level data worth importing
export const SUPPORTED_IMPORT_TYPES: { value: ImportType; label: string }[] = [
  { value: 'new_clients', label: 'New Clients' },
  { value: 'active_memberships', label: 'Active Memberships' },
  { value: 'lapsed_clients', label: 'Lapsed Clients' },
  { value: 'frequent_clients', label: 'Frequent Clients' },
  { value: 'client_credit', label: 'Client Credit' },
];

function parseName(fullName: string): { firstName?: string; lastName?: string } {
  const trimmed = fullName?.trim() ?? '';
  if (!trimmed) return {};
  const idx = trimmed.indexOf(' ');
  if (idx === -1) return { firstName: trimmed };
  return { firstName: trimmed.slice(0, idx), lastName: trimmed.slice(idx + 1) };
}

function parseDate(value: string): Date | undefined {
  if (!value?.trim()) return undefined;
  const d = new Date(value.trim());
  return isNaN(d.getTime()) ? undefined : d;
}

function parseOptIn(value: string): boolean | undefined {
  const v = value?.trim().toLowerCase();
  if (v === 'yes' || v === 'true' || v === '1') return true;
  if (v === 'no' || v === 'false' || v === '0') return false;
  return undefined;
}

function parseVisits(value: string): number | undefined {
  const n = parseInt(value?.trim() ?? '', 10);
  return isNaN(n) ? undefined : n;
}

// Normalize row keys to trim whitespace (Instabook sometimes has trailing spaces)
function normalize(row: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k.trim(), v?.trim() ?? '']));
}

type RowParser = (row: Record<string, string>) => ContactUpsert | null;

const parsers: Partial<Record<ImportType, RowParser>> = {
  new_clients: (raw) => {
    const row = normalize(raw);
    const email = row['Client Email'];
    if (!email) return null;
    const contact: ContactUpsert = { email, ...parseName(row['Client Name']) };
    const optIn = parseOptIn(row['Opt-In']);
    if (optIn !== undefined) contact.optIn = optIn;
    const totalVisits = parseVisits(row['Bookings']);
    if (totalVisits !== undefined) contact.totalVisits = totalVisits;
    const joinedAt = parseDate(row['Joined']);
    if (joinedAt) contact.joinedAt = joinedAt;
    return contact;
  },

  active_memberships: (raw) => {
    const row = normalize(raw);
    const email = row['Client Email'];
    if (!email) return null;
    const contact: ContactUpsert = { email, ...parseName(row['Client Name']) };
    const optIn = parseOptIn(row['Opt-In']);
    if (optIn !== undefined) contact.optIn = optIn;
    if (row['Membership']) contact.membershipName = row['Membership'];
    const startDate = parseDate(row['Start Date']);
    if (startDate) contact.membershipStartDate = startDate;
    const endDate = parseDate(row['Next Renewal / End']);
    if (endDate) contact.membershipEndDate = endDate;
    return contact;
  },

  lapsed_clients: (raw) => {
    const row = normalize(raw);
    const email = row['Client Email'];
    if (!email) return null;
    const contact: ContactUpsert = { email, ...parseName(row['Client Name']) };
    const lastVisitAt = parseDate(row['Last Visit']);
    if (lastVisitAt) contact.lastVisitAt = lastVisitAt;
    return contact;
  },

  frequent_clients: (raw) => {
    const row = normalize(raw);
    const email = row['Client Email'];
    if (!email) return null;
    const contact: ContactUpsert = { email, ...parseName(row['Client Name']) };
    const totalVisits = parseVisits(row['Visits']);
    if (totalVisits !== undefined) contact.totalVisits = totalVisits;
    return contact;
  },

  client_credit: (raw) => {
    const row = normalize(raw);
    const email = row['Client Email'];
    if (!email) return null;
    return { email, ...parseName(row['Client Name']) };
  },
};

export function parseRows(
  importType: ImportType,
  rows: Record<string, string>[]
): { contacts: ContactUpsert[]; skipped: number } {
  const parser = parsers[importType];
  if (!parser) return { contacts: [], skipped: rows.length };

  const contacts: ContactUpsert[] = [];
  let skipped = 0;

  for (const row of rows) {
    const parsed = parser(row);
    if (parsed) {
      contacts.push(parsed);
    } else {
      skipped++;
    }
  }

  return { contacts, skipped };
}

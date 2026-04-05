'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/import', label: 'Import Data' },
  { href: '/contacts', label: 'Contacts' },
  { href: '/audiences', label: 'Audiences' },
  { href: '/templates', label: 'Templates' },
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/automations', label: 'Automations' },
  { href: '/logs', label: 'Send Logs' },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {NAV_ITEMS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            className={`px-3 py-2 rounded-md text-sm transition-colors ${
              active
                ? 'bg-zinc-900 text-white font-medium'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

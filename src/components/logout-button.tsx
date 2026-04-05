'use client';

import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="w-full px-3 py-2 rounded-md text-sm text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors text-left"
    >
      Sign out
    </button>
  );
}

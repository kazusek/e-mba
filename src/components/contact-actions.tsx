'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function ContactActions({
  id,
  name,
  archived,
}: {
  id: string;
  name: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleArchive() {
    setLoading(true);
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !archived }),
      });
      if (!res.ok) {
        toast.error(archived ? 'Failed to unarchive contact' : 'Failed to archive contact');
        return;
      }
      toast.success(archived ? `${name} unarchived` : `${name} archived`);
      router.refresh();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Failed to delete contact');
        return;
      }
      toast.success(`${name} deleted`);
      router.refresh();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
      setConfirmDelete(false);
    }
  }

  const btnBase = 'text-xs transition-colors disabled:opacity-40';

  if (confirmDelete) {
    return (
      <div className="flex items-center gap-2 whitespace-nowrap">
        <span className="text-xs text-zinc-500">Delete?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className={`${btnBase} font-medium text-red-600 hover:text-red-800`}
        >
          {loading ? '…' : 'Yes'}
        </button>
        <button
          onClick={() => setConfirmDelete(false)}
          disabled={loading}
          className={`${btnBase} text-zinc-400 hover:text-zinc-600`}
        >
          No
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 whitespace-nowrap">
      <button
        onClick={handleArchive}
        disabled={loading}
        className={`${btnBase} text-zinc-400 hover:text-zinc-700`}
      >
        {archived ? 'Unarchive' : 'Archive'}
      </button>
      <button
        onClick={() => setConfirmDelete(true)}
        disabled={loading}
        className={`${btnBase} text-zinc-400 hover:text-red-500`}
      >
        Delete
      </button>
    </div>
  );
}

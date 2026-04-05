import AdminNav from '@/components/admin-nav';
import LogoutButton from '@/components/logout-button';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-zinc-200 bg-white flex flex-col py-6 gap-6">
        <div className="px-6">
          <span className="text-base font-semibold tracking-tight text-zinc-900">E-mba</span>
          <p className="text-xs text-zinc-400 mt-0.5">Email automation</p>
        </div>
        <AdminNav />
        <div className="mt-auto px-3">
          <LogoutButton />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 bg-zinc-50 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

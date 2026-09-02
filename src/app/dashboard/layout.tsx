// ============================================================
// Casa Quest — Dashboard Layout (Mor)
// Shell with sidebar navigation (desktop) and bottom bar (mobile)
// ============================================================

import Link from 'next/link';
import { SignOutButton } from '@/components/layout/signout-button';
import { DashboardSidebar, DashboardMobileNav } from '@/components/layout/dashboard-nav';
import { AuthGuardClient } from './auth-guard-client';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuardClient>
      <div className="flex min-h-screen">
        {/* Sidebar — desktop */}
        <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r border-gray-200 bg-white lg:flex">
          <Link
            href="/dashboard"
            className="flex h-14 items-center gap-2 border-b border-gray-200 px-4"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-base shadow-sm">
              🏠
            </span>
            <span className="text-lg font-bold tracking-tight text-gray-900">Casa Quest</span>
          </Link>

          <DashboardSidebar />

          <div className="border-t border-gray-200 p-4">
            <SignOutButton />
          </div>
        </aside>

        <DashboardMobileNav />

        {/* Main content */}
        <main className="flex-1 pb-20 lg:pb-0">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </AuthGuardClient>
  );
}

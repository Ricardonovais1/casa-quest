// ============================================================
// Casa Quest — Dashboard Layout (Mor)
// Shell with sidebar navigation
// ============================================================

import Link from 'next/link';
import { Shield } from 'lucide-react';
import { SignOutButton } from '@/components/layout/signout-button';
import { AuthGuardClient } from './auth-guard-client';

const navigation = [
  { name: 'Visão Geral', href: '/dashboard', icon: '🏠' },
  { name: 'Família', href: '/dashboard/familia', icon: '👨‍👩‍👧‍👦' },
  { name: 'Guardiões', href: '/dashboard/guardioes', icon: '🦸' },
  { name: 'Ações', href: '/dashboard/acoes', icon: '✅' },
  { name: 'Missões', href: '/dashboard/missoes', icon: '🎯' },
  { name: 'Energia', href: '/dashboard/energia', icon: '⚡' },
  { name: 'Configurações', href: '/dashboard/config', icon: '⚙️' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuardClient>
    <div className="flex min-h-screen">
      {/* Sidebar — desktop */}
      <aside className="hidden w-64 flex-col border-r border-gray-200 bg-white lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-gray-200 px-4">
          <Shield className="h-6 w-6 text-indigo-600" />
          <span className="text-lg font-bold text-gray-900">Casa Quest</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <span className="text-lg">{item.icon}</span>
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="border-t border-gray-200 p-4">
          <SignOutButton />
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-gray-200 bg-white px-2 py-1 lg:hidden">
        {navigation.slice(0, 5).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-0.5 px-2 py-1 text-xs text-gray-500 hover:text-indigo-600"
          >
            <span className="text-lg">{item.icon}</span>
            <span className="text-[10px]">{item.name}</span>
          </Link>
        ))}
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
    </AuthGuardClient>
  );
}

'use client';

// ============================================================
// Casa Quest — Dashboard navigation (Mor)
// Sidebar on desktop, bottom bar on mobile with a "Mais" sheet so
// every section is reachable from a phone.
// ============================================================

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { SignOutButton } from './signout-button';

export const NAVIGATION = [
  { name: 'Hoje', href: '/dashboard/hoje', icon: '☀️', hint: 'Confirmar e acompanhar o dia' },
  { name: 'Visão geral', href: '/dashboard', icon: '🏠', hint: 'Resumo e primeiros passos' },
  { name: 'Família', href: '/dashboard/familia', icon: '👨‍👩‍👧‍👦', hint: 'Membros e links de acesso' },
  { name: 'Guardiões', href: '/dashboard/guardioes', icon: '🦸', hint: 'Cadastro das crianças' },
  { name: 'Ações', href: '/dashboard/acoes', icon: '✅', hint: 'Hábitos, colaboração e extras' },
  { name: 'Distribuição', href: '/dashboard/distribuicao', icon: '🎲', hint: 'Quem faz o quê no período' },
  { name: 'Missões', href: '/dashboard/missoes', icon: '🎯', hint: 'Períodos e mesada-alvo' },
  { name: 'Energia', href: '/dashboard/energia', icon: '⚡', hint: 'Compromisso de cada guardião' },
  { name: 'Configurações', href: '/dashboard/config', icon: '⚙️', hint: 'Regras da casa' },
] as const;

const MOBILE_PRIMARY = ['/dashboard/hoje', '/dashboard', '/dashboard/familia', '/dashboard/missoes'];

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardSidebar() {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-0.5 px-3 py-4">
      {NAVIGATION.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardMobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const primary = NAVIGATION.filter((n) => MOBILE_PRIMARY.includes(n.href));
  const secondary = NAVIGATION.filter((n) => !MOBILE_PRIMARY.includes(n.href));
  const moreActive = secondary.some((n) => isActive(pathname, n.href));

  return (
    <>
      {open && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-gray-900/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {open && (
        <div className="fixed inset-x-0 bottom-14 z-50 rounded-t-2xl border-t border-gray-200 bg-white p-3 pb-4 shadow-2xl lg:hidden">
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Mais seções
          </p>
          <div className="grid grid-cols-2 gap-2">
            {secondary.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium',
                  isActive(pathname, item.href)
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-700'
                )}
              >
                <span className="text-lg leading-none">{item.icon}</span>
                <span className="min-w-0 truncate">{item.name}</span>
              </Link>
            ))}
          </div>
          <div className="mt-3 flex justify-end px-2">
            <SignOutButton />
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-50 flex h-14 items-stretch justify-around border-t border-gray-200 bg-white px-1 lg:hidden">
        {primary.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium',
                active ? 'text-indigo-600' : 'text-gray-500'
              )}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {item.name}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium',
            open || moreActive ? 'text-indigo-600' : 'text-gray-500'
          )}
        >
          <span className="text-lg leading-none">{open ? '✕' : '☰'}</span>
          Mais
        </button>
      </nav>
    </>
  );
}

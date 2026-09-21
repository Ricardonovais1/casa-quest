// ============================================================
// Casa Quest — Moldura das páginas legais
//
// Termos e Privacidade têm a mesma cara: cabeçalho com a volta para o
// site, título, a versão e a data por extenso, e o texto numa coluna
// estreita. Quem lê isto é um pai ou uma mãe no celular, não um jurista
// no computador.
// ============================================================

import Link from 'next/link';
import { VIGENTE_DESDE } from '@/lib/legal';

export function LegalPage({
  title,
  version,
  children,
}: {
  title: string;
  version: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-lg shadow-sm">
            🏠
          </span>
          <span className="text-lg font-bold tracking-tight text-gray-900">Casa Quest</span>
        </Link>
        <Link href="/" className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">
          ← Voltar
        </Link>
      </header>

      <article className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">{title}</h1>
        <p className="mt-2 text-xs text-gray-500">
          Versão {version} · em vigor desde {VIGENTE_DESDE}
        </p>
        <div className="mt-8 space-y-8">{children}</div>
      </article>
    </main>
  );
}

export function Secao({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}

export function Lista({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2 pl-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden className="text-gray-300">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ============================================================
// Casa Quest — Landing Page
// ============================================================

import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center">
      {/* Logo */}
      <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl">
        <span className="text-5xl">🏠</span>
      </div>

      {/* Hero */}
      <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
        Casa Quest
      </h1>
      <p className="mb-2 max-w-md text-lg text-gray-600">
        Responsabilidade não se compra.
        <br />
        Se cultiva.
      </p>
      <p className="mb-10 max-w-md text-sm text-gray-500">
        O aplicativo que separa <strong>ação</strong> de{' '}
        <strong>dinheiro</strong> e ajuda sua família a desenvolver
        compromisso, cooperação e autonomia.
      </p>

      {/* CTA Buttons */}
      <div className="flex w-full max-w-xs flex-col gap-3">
        <Link
          href="/signup"
          className="rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500"
        >
          Criar minha família
        </Link>
        <Link
          href="/login"
          className="rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 transition-colors hover:bg-gray-50"
        >
          Já tenho conta
        </Link>
      </div>

      {/* Features */}
      <div className="mt-20 grid max-w-2xl gap-8 sm:grid-cols-3">
        <Feature
          icon="🎯"
          title="Missões"
          description="Ciclos de 7, 15 ou 30 dias com metas claras de responsabilidade."
        />
        <Feature
          icon="⚡"
          title="Energia"
          description="Métrica abstrata de compromisso — nunca mostrada como dinheiro."
        />
        <Feature
          icon="🤝"
          title="Cooperação"
          description="Trabalho em equipe. Um ajuda o outro, sem competição."
        />
      </div>
    </main>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="mb-3 text-3xl">{icon}</span>
      <h3 className="mb-1 text-sm font-semibold text-gray-900">{title}</h3>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}

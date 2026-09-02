// ============================================================
// Casa Quest — Landing Page
// ============================================================

import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-lg shadow-sm">
            🏠
          </span>
          <span className="text-lg font-bold tracking-tight text-gray-900">Casa Quest</span>
        </div>
        <Link
          href="/login"
          className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
        >
          Entrar
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pb-16 pt-12 text-center sm:pt-20">
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
          Para famílias com crianças e adolescentes
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Responsabilidade não se compra.
          <br />
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Se cultiva.
          </span>
        </h1>
        <p className="mt-5 max-w-xl text-base text-gray-600 sm:text-lg">
          A Casa Quest organiza as tarefas da casa em missões, dá a cada filho um link próprio para
          marcar o que fez, e transforma constância em uma <strong>energia de compromisso</strong>{' '}
          que orienta a mesada. Sem transformar tarefa em moeda de troca.
        </p>

        <div className="mt-8 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          <Link
            href="/signup"
            className="rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500"
          >
            Criar a minha casa
          </Link>
          <Link
            href="/login"
            className="rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 transition-colors hover:bg-gray-50"
          >
            Já tenho conta
          </Link>
        </div>
        <p className="mt-3 text-xs text-gray-400">Grátis. Leva 3 minutos para configurar.</p>
      </section>

      {/* How it works */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold text-gray-900">Como funciona</h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-sm text-gray-500">
            Um adulto é o Guardião-Mor. Cada criança ou adolescente é um Guardião.
          </p>

          <ol className="mt-10 grid gap-6 sm:grid-cols-3">
            <StepCard
              number="1"
              icon="🛠️"
              title="Monte a sua casa"
              text="Cadastre os guardiões e escolha as ações: hábitos individuais, tarefas colaborativas, tropeços a evitar e missões extras. Vem com um catálogo pronto."
            />
            <StepCard
              number="2"
              icon="📱"
              title="Cada guardião tem seu link"
              text="Sem senha, sem cadastro. Abre no celular, vê as ações do dia e marca “Fiz!”. Você confirma o que quiser no painel “Hoje”."
            />
            <StepCard
              number="3"
              icon="⚡"
              title="A energia conta a história"
              text="Faltas seguidas pesam mais que uma isolada. Missões extras recuperam. Escaladas passam de 100. No fim da missão, a energia sugere a mesada — e só o adulto vê o valor."
            />
          </ol>
        </div>
      </section>

      {/* Principles */}
      <section className="py-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold text-gray-900">O que a Casa Quest defende</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Principle
              icon="🎯"
              title="Ação não é dinheiro"
              text="Os guardiões nunca veem valores. Eles veem energia, constância e cooperação. A mesada é uma decisão do adulto, informada — não uma transação por tarefa."
            />
            <Principle
              icon="🤝"
              title="Cooperação, não competição"
              text="As tarefas da casa são distribuídas de forma equilibrada por pontos e rodam a cada período. Ajudar um irmão vale cooperação."
            />
            <Principle
              icon="🔁"
              title="Errar faz parte, desistir não"
              text="Uma falta isolada custa pouco. O que pesa é a sequência. E sempre existe um caminho de volta: as missões extras compensam."
            />
            <Principle
              icon="🔍"
              title="Transparência total"
              text="Cada regra é configurável e visível: tolerância de atraso, quem confirma, duração da missão. Nada de caixa-preta."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-indigo-600 to-purple-700 py-14 text-white">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold">Pronto para começar?</h2>
          <p className="mt-2 text-sm text-indigo-100">
            Crie sua conta, cadastre a família e envie os links pelo WhatsApp. Hoje mesmo.
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-block rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-50"
          >
            Criar a minha casa
          </Link>
        </div>
      </section>

      <footer className="py-6 text-center text-xs text-gray-400">
        Casa Quest · feito por uma família, para famílias.
      </footer>
    </main>
  );
}

function StepCard({
  number,
  icon,
  title,
  text,
}: {
  number: string;
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <li className="relative rounded-2xl border border-gray-200 bg-gray-50 p-6">
      <span className="absolute -top-3 left-6 rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-bold text-white">
        {number}
      </span>
      <span className="text-3xl">{icon}</span>
      <h3 className="mt-3 text-base font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-600">{text}</p>
    </li>
  );
}

function Principle({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="flex gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <span className="text-2xl">{icon}</span>
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-600">{text}</p>
      </div>
    </div>
  );
}

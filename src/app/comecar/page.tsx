// ============================================================
// Casa Quest — Página de vendas (/comecar)
//
// Segue a ordem do VSL (marketing/roteiro-vsl.md): dor → problema real →
// virada → como funciona → a criança nunca vê dinheiro → energia →
// objeções → prova → oferta → dúvidas. As objeções vêm antes do preço.
//
// A oferta diz a verdade de hoje: não há cobrança no app. Os 30 dias
// grátis são a primeira missão, e nada é cobrado sem a casa aceitar
// (ver "Preço, cobrança e cancelamento" em /termos).
// ============================================================

import type { Metadata } from 'next';
import Link from 'next/link';

const PRECO_MENSAL = 'R$ 19,90';
const DIAS_GRATIS = 30;

// Quando o VSL estiver exportado, aponte para o arquivo (ex.: '/vsl.mp4',
// em public/) e a seção do vídeo troca a prévia da tela pelo player.
const VSL_SRC: string | null = null;
const VSL_POSTER: string | undefined = undefined;

export const metadata: Metadata = {
  title: 'Comece grátis',
  description:
    'O combinado da casa sai da sua cabeça e vai para onde todo mundo vê. Cada filho com seu link, sem senha, e a constância virando energia. Primeira missão grátis.',
  openGraph: {
    title: 'Casa Quest — primeira missão grátis',
    description: 'Responsabilidade não se compra, se cultiva. 30 dias grátis, sem cartão.',
    locale: 'pt_BR',
    type: 'website',
  },
};

export default function ComecarPage() {
  return (
    <main className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-lg shadow-sm">
            🏠
          </span>
          <span className="text-lg font-bold tracking-tight text-gray-900">Casa Quest</span>
        </Link>
        <Link
          href="/login"
          className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
        >
          Entrar
        </Link>
      </header>

      {/* 1 · A frase repetida */}
      <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pb-12 pt-10 text-center sm:pt-16">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Você já disse hoje, pela terceira vez, a mesma frase.
        </h1>
        <p className="mt-5 max-w-xl text-base text-gray-600 sm:text-lg">
          “Arruma esse quarto.” “Senta e estuda.” “Tira a louça, por favor.”{' '}
          <strong className="text-gray-900">E amanhã você vai dizer de novo.</strong>
        </p>
        <p className="mt-4 max-w-xl text-base text-gray-600 sm:text-lg">
          A Casa Quest tira o combinado da casa da sua cabeça e coloca num lugar onde todo mundo vê.
        </p>
        <CtaButton className="mt-8" />
        <CtaNote />
      </section>

      {/* 2 · O vídeo */}
      <section className="mx-auto w-full max-w-4xl px-4 pb-16 sm:px-6">
        {VSL_SRC ? (
          <video
            src={VSL_SRC}
            poster={VSL_POSTER}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full rounded-2xl bg-black shadow-lg ring-1 ring-gray-200"
          />
        ) : (
          <div className="flex justify-center rounded-3xl bg-gradient-to-br from-indigo-50 to-purple-50 px-4 py-10 ring-1 ring-indigo-100">
            <GuardianPhoneMock />
          </div>
        )}
      </section>

      {/* 3 · O problema não é preguiça */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <Eyebrow>O problema real</Eyebrow>
          <h2 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            Não é preguiça. É que o combinado mora só na sua cabeça.
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-3">
            <PainCard
              icon="📝"
              text="Não está escrito em lugar nenhum. Ninguém sabe o que já fez e o que falta."
            />
            <PainCard
              icon="🔁"
              text="Todo dia começa do zero, com você sendo o lembrete ambulante da família."
            />
            <PainCard
              icon="💸"
              text="Quando chega a mesada, vira negociação. Ou vira castigo. E nunca vira responsabilidade."
            />
          </ul>
        </div>
      </section>

      {/* 4 · A virada */}
      <section className="py-14 text-center">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Responsabilidade não se compra.
            <br />
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Se cultiva.
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-gray-600">
            A Casa Quest não é um app de tarefas. É um jeito de a constância virar algo visível: para a
            criança, e para você.
          </p>
        </div>
      </section>

      {/* 5 · Como funciona */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center">
            <Eyebrow>Como funciona</Eyebrow>
            <h2 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
              Três minutos hoje. Menos uma briga amanhã.
            </h2>
          </div>
          <ol className="mt-10 grid gap-6 sm:grid-cols-3">
            <StepCard
              number="1"
              icon="🛠️"
              title="Monte a casa"
              text="O catálogo de ações já vem pronto: hábitos, tarefas colaborativas, tropeços a evitar e missões extras. Você tira o que não serve e acrescenta o que é da sua casa."
            />
            <StepCard
              number="2"
              icon="⚖️"
              title="O app divide as tarefas"
              text="As tarefas da casa são distribuídas equilibrando o esforço de cada um, e trocam de mão a cada período. Acabou o “sempre eu” e o “ela nunca faz nada”."
            />
            <StepCard
              number="3"
              icon="📱"
              title="Cada filho recebe um link"
              text="Pelo WhatsApp. Sem conta, sem senha, sem baixar nada. Abre, vê o dia dele, marca “Fiz!” com um toque. E, quando faz algo a mais, registra sozinho."
            />
          </ol>
        </div>
      </section>

      {/* 6 · A criança nunca vê dinheiro */}
      <section className="py-14">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 sm:px-6 md:grid-cols-2">
          <div>
            <Eyebrow>O mais importante</Eyebrow>
            <h2 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
              A criança nunca vê dinheiro na Casa Quest.
            </h2>
            <p className="mt-4 text-base text-gray-600">
              Na tela do seu filho não existe preço por tarefa nem valor de mesada. O que ele vê é{' '}
              <strong className="text-gray-900">energia</strong>: o retrato do compromisso dele com o
              que foi combinado.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-gray-700">
              <Check>Uma falta isolada custa pouco. Errar faz parte.</Check>
              <Check>O que pesa é a sequência, porque é ela que vira hábito.</Check>
              <Check>Sempre existe volta: uma missão extra recupera o que a falta tirou.</Check>
              <Check>
                No fim da missão, a energia <em>sugere</em> um valor de mesada, só para você. Quem
                decide, combina e paga continua sendo você.
              </Check>
            </ul>
          </div>
          <div className="flex justify-center">
            <EnergyMock />
          </div>
        </div>
      </section>

      {/* 7 · Objeções */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="text-center">
            <Eyebrow>Você deve estar pensando</Eyebrow>
            <h2 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
              As três dúvidas que todo mundo tem
            </h2>
          </div>
          <div className="mt-8 space-y-4">
            <Objection
              quote="Isso é pagar meu filho para ajudar em casa."
              answer="É o contrário. Pagar por tarefa é transação: fez, recebeu. Aqui não há preço por tarefa, e a criança não vê valor nenhum. Ela acompanha o compromisso com o que foi combinado. E dá para usar a Casa Quest sem mesada alguma, só pelo espelho que a energia dá."
            />
            <Objection
              quote="Meu filho não usa nem o que eu mando."
              answer="Não é mais um aplicativo para instalar. É um link, sem senha, que mostra as ações do dia e fecha."
            />
            <Objection
              quote="Só serve para tarefa doméstica."
              answer="Serve para o que a sua casa combinar: estudar todo dia, ler antes de dormir, praticar o instrumento, cuidar do próprio material. Tarefa de casa é só a categoria mais óbvia."
            />
          </div>
        </div>
      </section>

      {/* 8 · Prova */}
      <section className="py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <figure className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100 sm:p-10">
            <blockquote className="text-lg leading-relaxed text-gray-800 sm:text-xl">
              “Eu fiz a Casa Quest para a minha casa, antes de ser para a sua. Tenho três filhas, e a
              briga da louça era diária. Um dia o app me mandou um e-mail: a energia de uma delas
              tinha caído. Não era acusação, vinha com o que fazer, no app e em casa. Eu não teria
              percebido a tempo. E não precisei brigar para perceber.”
            </blockquote>
            <figcaption className="mt-6 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-base font-bold text-white">
                R
              </span>
              <span className="text-sm">
                <span className="block font-semibold text-gray-900">Ricardo</span>
                <span className="text-gray-500">Criador da Casa Quest</span>
              </span>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* 9 · Oferta */}
      <section id="oferta" className="bg-gradient-to-br from-indigo-600 to-purple-700 py-16 text-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">A primeira missão é por nossa conta</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-indigo-100 sm:text-base">
              {DIAS_GRATIS} dias com a casa inteira funcionando. Sem cartão.
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-md rounded-3xl bg-white p-6 text-gray-900 shadow-xl sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
              Casa Quest · por casa
            </p>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-bold">Grátis</span>
              <span className="text-sm text-gray-500">por {DIAS_GRATIS} dias</span>
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Depois, <strong className="text-gray-900">{PRECO_MENSAL}/mês</strong> se decidir
              continuar.
            </p>

            <ul className="mt-6 space-y-3 text-sm text-gray-700">
              <Check>Todos os filhos da casa, cada um com seu link</Check>
              <Check>Os outros adultos entram como Conselheiros, sem custo extra</Check>
              <Check>Catálogo de ações pronto e distribuição automática das tarefas</Check>
              <Check>Energia de compromisso e sugestão de mesada no fim da missão</Check>
              <Check>Alerta por e-mail quando a energia de alguém cai</Check>
            </ul>

            <CtaButton className="mt-8 w-full" />
            <p className="mt-4 text-center text-xs text-gray-500">
              Nada é cobrado sem você aceitar. Se ao fim da missão a casa não estiver mais leve, você
              não paga nada. E, se assinar, tem 7 dias para desistir e receber o valor de volta.
            </p>
          </div>
        </div>
      </section>

      {/* 10 · Dúvidas */}
      <section className="py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold text-gray-900">Perguntas frequentes</h2>
          <div className="mt-8 space-y-3">
            <Faq question="Preciso colocar cartão para começar?">
              Não. Você cria a casa com e-mail e senha e usa a primeira missão inteira sem cadastrar
              forma de pagamento.
            </Faq>
            <Faq question={`O que acontece depois dos ${DIAS_GRATIS} dias?`}>
              Você escolhe se continua por {PRECO_MENSAL}/mês. Antes de qualquer cobrança você é
              avisado por e-mail, e nada passa a ser cobrado sem você aceitar.
            </Faq>
            <Faq question="Meu filho precisa de celular próprio ou de conta?">
              Não precisa de conta nem de senha. O link abre em qualquer navegador, no celular dele
              ou no seu. Dá para instalar na tela inicial, mas não é obrigatório.
            </Faq>
            <Faq question="Quantos filhos posso cadastrar?">
              Todos os da casa. O preço é por casa, não por filho. Os outros adultos entram como
              Conselheiros, com os mesmos poderes de decisão.
            </Faq>
            <Faq question="Funciona sem mesada?">
              Sim. A mesada é opcional: a energia sugere um valor só para o adulto, e muitas casas
              usam a Casa Quest apenas pelo acompanhamento da constância.
            </Faq>
            <Faq question="Posso cancelar quando quiser?">
              Sim, a qualquer momento e sem multa. O acesso continua até o fim do período já pago.
            </Faq>
            <Faq question="E os dados dos meus filhos?">
              A criança não cria conta e não informa e-mail nem telefone. Tudo o que guardamos e por
              quê está na{' '}
              <Link href="/privacidade" className="font-semibold text-indigo-600 hover:underline">
                Política de Privacidade
              </Link>
              .
            </Faq>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Três minutos hoje, e amanhã você não precisa repetir a frase pela terceira vez.
          </h2>
          <CtaButton className="mt-8" />
          <CtaNote />
        </div>
      </section>

      <footer className="flex flex-col items-center gap-2 py-6 text-center text-xs text-gray-400">
        <p>Casa Quest · feito por uma família, para famílias.</p>
        <p className="flex items-center gap-3">
          <Link href="/termos" className="hover:text-gray-600">
            Termos de Uso
          </Link>
          <span aria-hidden>·</span>
          <Link href="/privacidade" className="hover:text-gray-600">
            Privacidade
          </Link>
        </p>
      </footer>
    </main>
  );
}

function CtaButton({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/signup"
      className={`inline-block rounded-xl bg-indigo-600 px-7 py-4 text-center text-base font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 ${className}`}
    >
      Criar a minha casa grátis
    </Link>
  );
}

function CtaNote() {
  return (
    <p className="mt-3 text-xs text-gray-500">
      {DIAS_GRATIS} dias grátis · sem cartão · pronto em 3 minutos
    </p>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">{children}</p>
  );
}

function PainCard({ icon, text }: { icon: string; text: string }) {
  return (
    <li className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
      <span className="text-2xl">{icon}</span>
      <p className="mt-3 text-sm text-gray-700">{text}</p>
    </li>
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

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

function Objection({ quote, answer }: { quote: string; answer: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 sm:p-6">
      <p className="text-base font-semibold text-gray-900">“{quote}”</p>
      <p className="mt-2 text-sm text-gray-600">{answer}</p>
    </div>
  );
}

function Faq({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-gray-900">
        {question}
        <span className="text-lg text-gray-400 transition-transform group-open:rotate-45" aria-hidden>
          +
        </span>
      </summary>
      <p className="mt-3 text-sm text-gray-600">{children}</p>
    </details>
  );
}

// Prévia estática da tela do guardião, no lugar do vídeo enquanto ele não
// existe. Os textos imitam a tela real de /g/[token].
function GuardianPhoneMock() {
  const actions = [
    { label: 'Arrumar a cama', done: true },
    { label: 'Tirar a louça do jantar', done: true },
    { label: 'Ler 20 minutos', done: false },
    { label: 'Praticar violão', done: false },
    { label: 'Guardar o material da escola', done: false },
  ];
  return (
    <div
      aria-hidden
      className="w-full max-w-[300px] rounded-[2.2rem] bg-gray-900 p-2.5 shadow-2xl"
    >
      <div className="rounded-[1.8rem] bg-gray-50 px-4 pb-6 pt-8">
        <p className="text-lg font-bold text-gray-900">Oi, Aurora! 👋</p>
        <p className="text-xs text-gray-500">2 de 5 feitas</p>
        <EnergyBar value={78} className="mt-4" />
        <ul className="mt-4 space-y-2">
          {actions.map((a) => (
            <li
              key={a.label}
              className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2.5 text-xs shadow-sm ring-1 ring-gray-100"
            >
              <span className={a.done ? 'text-gray-400 line-through' : 'text-gray-800'}>
                {a.label}
              </span>
              {a.done ? (
                <span className="font-semibold text-emerald-600">Feito ✓</span>
              ) : (
                <span className="rounded-lg bg-indigo-600 px-2.5 py-1 font-semibold text-white">
                  Fiz! ✓
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center text-xs font-semibold text-indigo-600">🏆 Fez algo a mais?</p>
      </div>
    </div>
  );
}

function EnergyMock() {
  return (
    <div
      aria-hidden
      className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-lg ring-1 ring-gray-100"
    >
      <p className="text-sm font-semibold text-gray-900">Energia de compromisso</p>
      <EnergyBar value={86} className="mt-3" />
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-orange-50 px-3 py-1 text-orange-700 ring-1 ring-orange-100">
          🔥 6 dias sem falta
        </span>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 ring-1 ring-emerald-100">
          Compromisso Forte
        </span>
      </div>
      <p className="mt-5 rounded-xl bg-gray-50 p-3 text-xs text-gray-500">
        Nenhum valor em dinheiro aparece aqui. Nunca.
      </p>
    </div>
  );
}

function EnergyBar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
        <span>⚡ Energia</span>
        <span>{value}</span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

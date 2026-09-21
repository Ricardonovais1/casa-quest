// ============================================================
// Casa Quest — Termos de Uso
//
// O que a casa contrata ao criar uma conta. A seção de cobrança já está
// escrita, mas diz a verdade de hoje: o app é gratuito, e as regras valem
// a partir do dia em que existir um plano pago.
//
// Como a Política de Privacidade, isto é verdadeiro em relação ao código
// e está à espera da revisão de um advogado. Ver src/lib/legal.ts.
// ============================================================

import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Secao, Lista } from '@/components/legal/legal-page';
import { CONTROLADOR, TERMOS_VERSAO } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Termos de Uso',
  description: 'As regras de quem usa a Casa Quest: quem pode criar uma casa, o que é a mesada, e como será a cobrança.',
};

export default function TermosPage() {
  return (
    <LegalPage title="Termos de Uso" version={TERMOS_VERSAO}>
      <Secao title="O que é a Casa Quest">
        <p>
          Um app para uma família organizar as tarefas da casa em missões. Um adulto monta a casa,
          cada criança ou adolescente recebe um link próprio para marcar o que fez, e a constância
          vira uma energia de compromisso que, no fim da missão, sugere um valor de mesada.
        </p>
        <p>
          Quem oferece o serviço é {CONTROLADOR.razaoSocial}, CNPJ {CONTROLADOR.cnpj}. Contato:{' '}
          <strong>{CONTROLADOR.contato}</strong>.
        </p>
      </Secao>

      <Secao title="Quem pode criar uma casa">
        <Lista
          items={[
            <>Você precisa ter 18 anos ou mais para criar a conta.</>,
            <>
              Ao cadastrar uma criança ou adolescente, você declara ser pai, mãe ou responsável
              legal por ela, ou ter a autorização de quem é.
            </>,
            <>
              Você escolhe que nome usar para cada guardião. Um apelido serve, e costuma ser
              suficiente.
            </>,
            <>
              Ao convidar outro adulto como Conselheiro(a), você aceita que ele passe a ver o que a
              casa tem — e, se você ligar “poderes iguais”, também a decidir regras, missões e
              mesada.
            </>,
          ]}
        />
      </Secao>

      <Secao title="O link de cada guardião">
        <p>
          O link é a chave: quem o tem, entra. Ele não pede senha de propósito, para uma criança
          conseguir usar sem conta. Cuidar de com quem esse link é compartilhado é sua
          responsabilidade, e você pode cancelá-lo e gerar outro a qualquer momento, na tela de
          Guardiões.
        </p>
      </Secao>

      <Secao title="A mesada é decisão da família">
        <p>
          A Casa Quest <strong>não movimenta dinheiro</strong>. Ela calcula uma energia e sugere um
          valor; quem decide, combina e paga é a família, fora do app. Não somos instituição de
          pagamento, não intermediamos mesada, e não guardamos dado bancário de ninguém.
        </p>
      </Secao>

      <Secao title="O que esperamos de você">
        <Lista
          items={[
            <>Usar a Casa Quest para a sua própria casa, e não para vigiar ou constranger alguém.</>,
            <>
              Não tentar alcançar os dados de outra família, nem contornar os limites técnicos do
              app.
            </>,
            <>Manter o seu e-mail e a sua senha em segurança — a conta é sua e das suas decisões.</>,
          ]}
        />
      </Secao>

      <Secao title="Preço, cobrança e cancelamento">
        <p>
          <strong>Hoje a Casa Quest é gratuita.</strong> Quando existir um plano pago, valem estas
          regras, e o preço é informado antes da compra, na própria tela de pagamento:
        </p>
        <Lista
          items={[
            <>
              Quem já tem casa criada é avisado por e-mail antes de qualquer cobrança começar, e
              nada passa a ser cobrado sem você aceitar.
            </>,
            <>
              <strong>Arrependimento:</strong> você tem 7 dias a partir da compra para desistir e
              receber o valor de volta, como manda o Código de Defesa do Consumidor.
            </>,
            <>
              <strong>Cancelamento:</strong> a qualquer momento, sem multa. O acesso continua até o
              fim do período já pago.
            </>,
            <>
              O pagamento é processado por uma plataforma de checkout, que também emite a nota
              fiscal. O número do seu cartão não passa pela Casa Quest.
            </>,
            <>
              Se um pagamento falhar, avisamos por e-mail antes de qualquer coisa mudar na casa —
              uma missão em andamento não é interrompida no meio por causa disso.
            </>,
          ]}
        />
      </Secao>

      <Secao title="Disponibilidade, mudanças e fim">
        <Lista
          items={[
            <>
              A Casa Quest é um produto novo e em evolução. Podem existir falhas e paradas para
              manutenção; fazemos o possível para que sejam curtas, mas não prometemos
              funcionamento ininterrupto.
            </>,
            <>
              Funcionalidades podem mudar. Se uma mudança tirar algo que você já usava, avisamos por
              e-mail.
            </>,
            <>
              Você pode apagar a sua casa quando quiser, e com ela vai todo o histórico. Se
              decidirmos encerrar o serviço, avisamos com pelo menos 30 dias de antecedência e
              deixamos você levar os seus dados.
            </>,
            <>
              Podemos encerrar uma conta que use o app para prejudicar alguém, ou que tente
              alcançar dados de outra família.
            </>,
          ]}
        />
      </Secao>

      <Secao title="Responsabilidade">
        <p>
          A Casa Quest é uma ferramenta de organização familiar. As decisões sobre a educação das
          crianças, sobre o que é combinado em casa e sobre quanto e quando pagar a mesada são da
          família. Respondemos pelo funcionamento do app, nos limites da lei brasileira, e não por
          consequências de decisões tomadas dentro da casa.
        </p>
      </Secao>

      <Secao title="Dados pessoais">
        <p>
          O que guardamos, quem vê, por quanto tempo e como apagar está na{' '}
          <Link href="/privacidade" className="font-semibold text-indigo-600 hover:text-indigo-500">
            Política de Privacidade
          </Link>
          , que faz parte destes termos.
        </p>
      </Secao>

      <Secao title="Lei e foro">
        <p>
          Valem as leis do Brasil. Sendo você consumidor, qualquer discussão pode ser levada ao
          foro da sua própria comarca, como o Código de Defesa do Consumidor garante.
        </p>
      </Secao>
    </LegalPage>
  );
}

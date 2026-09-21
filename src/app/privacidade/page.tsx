// ============================================================
// Casa Quest — Política de Privacidade
//
// Escrita contra o esquema real em 16/09/2026, tabela a tabela: families,
// guardians, action_templates, missions, mission_guardians,
// mission_actions, action_confirmations, energy_events,
// cooperation_events, action_assignments e performance_alerts.
//
// Se uma coluna nova passar a guardar algo sobre uma pessoa, esta página
// muda junto — e com versão nova, nunca por cima. Ver src/lib/legal.ts.
// ============================================================

import type { Metadata } from 'next';
import { LegalPage, Secao, Lista } from '@/components/legal/legal-page';
import { CONTROLADOR, PRIVACIDADE_VERSAO, REGIAO_DOS_DADOS, RETENCAO } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description: 'O que a Casa Quest guarda sobre a sua família, quem vê, por quanto tempo e como apagar.',
};

export default function PrivacidadePage() {
  return (
    <LegalPage title="Política de Privacidade" version={PRIVACIDADE_VERSAO}>
      <Secao title="Em uma frase">
        <p>
          A Casa Quest guarda o que a sua casa combina e o que cada guardião faz no dia, para
          calcular a energia de compromisso e orientar a mesada. Não vendemos nada disso, não há
          publicidade, e quem vê é só quem mora na sua casa.
        </p>
      </Secao>

      <Secao title="Quem responde por estes dados">
        <p>
          {CONTROLADOR.razaoSocial}, CNPJ {CONTROLADOR.cnpj}, que mantém a Casa Quest. Para
          qualquer pedido sobre dados, escreva para <strong>{CONTROLADOR.contato}</strong>.
        </p>
        <p>
          Quem cadastra a família é um adulto — o <strong>Guardião-Mor</strong>. Ele declara ser
          pai, mãe ou responsável legal pelas crianças e adolescentes que cadastra, e é ele quem
          aceita esta política em nome delas.
        </p>
      </Secao>

      <Secao title="O que guardamos sobre os adultos">
        <Lista
          items={[
            <>
              O <strong>e-mail</strong> e a <strong>senha</strong> de quem cria a conta. A senha é
              guardada cifrada pelo Supabase, e nem nós a vemos.
            </>,
            <>
              O <strong>nome</strong> que o adulto escreve para si, e o <strong>gênero</strong>, se
              ele escolher — serve só para o app dizer “Conselheira” em vez de “Conselheiro(a)”.
            </>,
            <>
              O e-mail de cada <strong>Conselheiro(a)</strong> convidado, para poder mandar o
              convite.
            </>,
            <>
              A <strong>assinatura de cada decisão</strong>: quando um adulto confirma ou recusa
              uma ação, fica gravado que foi ele, e quando.
            </>,
            <>
              Registros técnicos de acesso — data, hora e endereço IP do login —, guardados pelo
              Supabase.
            </>,
          ]}
        />
      </Secao>

      <Secao title="O que guardamos sobre as crianças e adolescentes">
        <p>
          Tudo isto é escrito pelo próprio adulto da casa, ou pelo guardião no link dele. Nada é
          coletado por fora.
        </p>
        <Lista
          items={[
            <>
              O <strong>nome</strong> que o adulto escrever — pode ser o primeiro nome ou um
              apelido — e a <strong>idade</strong>, que é opcional.
            </>,
            <>
              O <strong>link pessoal</strong> do guardião: um código secreto que vive no endereço,
              sem senha, e que o adulto pode cancelar e gerar de novo quando quiser.
            </>,
            <>
              As <strong>ações</strong> da casa: o nome e a descrição que o adulto escreveu, a
              categoria, os pontos, a frequência e o horário — e quais são de cada guardião no
              período.
            </>,
            <>
              O <strong>dia a dia</strong>: o que foi marcado como feito e a que horas, o que ficou
              por fazer, os tropeços que um adulto registrou, e as missões extras — com quem as
              registrou, um adulto ou o próprio guardião.
            </>,
            <>
              A <strong>energia de compromisso</strong> calculada a partir disso, e os pontos de
              cooperação.
            </>,
            <>
              O valor-alvo e o valor final da <strong>mesada</strong> de cada guardião. Esse valor
              aparece só para os adultos: a tela do guardião nunca mostra dinheiro.
            </>,
            <>
              O histórico dos <strong>avisos por e-mail</strong> mandados aos adultos quando a
              energia de alguém cai, para o mesmo aviso não se repetir dias seguidos.
            </>,
          ]}
        />
      </Secao>

      <Secao title="O que não guardamos">
        <Lista
          items={[
            <>
              Não pedimos foto, data de nascimento, endereço, telefone, CPF, escola, nota escolar
              nem dado de saúde de ninguém.
            </>,
            <>
              As crianças e adolescentes <strong>não têm conta nem senha</strong>, e não há nenhum
              campo de e-mail para elas preencherem.
            </>,
            <>
              Não guardamos dado de pagamento. Enquanto a Casa Quest for gratuita não há cobrança;
              quando houver, quem processa o pagamento é a plataforma de checkout, e o número do
              cartão nunca passa por nós.
            </>,
            <>
              Não há publicidade, não há rastreador de anunciante, e não vendemos nem cedemos estes
              dados a ninguém.
            </>,
          ]}
        />
      </Secao>

      <Secao title="Quem vê o quê">
        <Lista
          items={[
            <>
              Os <strong>adultos da própria casa</strong> veem tudo da casa. O banco separa uma
              família da outra por política de acesso: a conta de uma família não alcança os dados
              de outra.
            </>,
            <>
              Cada <strong>guardião</strong> vê, pelo link dele, as próprias ações do dia, as
              próprias tarefas do período e a própria energia. Não vê valores em dinheiro, nem a
              tela dos outros.
            </>,
            <>
              Quem tiver o <strong>link de um guardião</strong> vê o que aquele guardião vê, porque
              o link é a chave. Por isso ele é secreto — e por isso o adulto pode cancelá-lo a
              qualquer momento, gerando outro.
            </>,
            <>
              Nós, da Casa Quest, só olhamos os dados de uma família se ela pedir ajuda com um
              problema, e só o necessário para resolvê-lo.
            </>,
          ]}
        />
      </Secao>

      <Secao title="Empresas que operam a Casa Quest por nós">
        <Lista
          items={[
            <>
              <strong>Supabase</strong> — banco de dados e login. É onde a sua casa fica guardada.
            </>,
            <>
              <strong>Vercel</strong> — hospedagem do app e registros técnicos de funcionamento.
            </>,
            <>
              <strong>Resend</strong> — envio dos dois e-mails que saem do app: o convite de
              Conselheiro(a) e o aviso de queda de energia. O e-mail do adulto passa por lá; sobre
              as crianças, só o primeiro nome e a energia vão no aviso.
            </>,
          ]}
        />
        <p>
          Os dados da sua casa ficam <strong>fora do Brasil</strong>: em servidores em{' '}
          {REGIAO_DOS_DADOS}, operados pela Supabase sobre a infraestrutura da Amazon Web Services.
          Pela LGPD isso é uma transferência internacional de dados, e ela acontece com base nas
          garantias contratuais dessas empresas. Se um dia essa região mudar, esta política muda
          junto, e avisamos antes.
        </p>
      </Secao>

      <Secao title="Por quanto tempo guardamos">
        <Lista
          items={[
            <>
              Enquanto a casa estiver em uso. Uma casa sem nenhum acesso por{' '}
              <strong>{RETENCAO.inatividadeMeses} meses</strong> é apagada por nós, sem ninguém
              precisar pedir.
            </>,
            <>
              Quando o adulto apaga a casa, apagamos junto tudo o que está ligado a ela: guardiões,
              ações, missões, histórico e energia.
            </>,
            <>
              As cópias de segurança se apagam sozinhas em até{' '}
              <strong>{RETENCAO.backupDias} dias</strong>. Um dado apagado a pedido some das cópias
              dentro desse prazo.
            </>,
          ]}
        />
      </Secao>

      <Secao title="Os seus direitos">
        <p>
          A LGPD dá a você, e às crianças que você representa, o direito de ver, corrigir, levar
          embora e apagar estes dados, e de retirar o consentimento. Escreva para{' '}
          <strong>{CONTROLADOR.contato}</strong> e respondemos em até {RETENCAO.respostaDias} dias.
        </p>
        <p>
          Boa parte disso você faz sozinho, na hora, dentro do app: editar o nome de um guardião,
          cancelar o link dele, apagar uma ação, encerrar uma missão ou apagar a casa inteira.
        </p>
      </Secao>

      <Secao title="Dados de crianças e adolescentes">
        <p>
          A Casa Quest existe para ser usada por famílias, e trata dado de criança no melhor
          interesse dela: sem publicidade, sem perfil para terceiros, e sem pedir mais informação
          do que o app precisa para funcionar. Nenhuma criança precisa fornecer dado nenhum para
          poder usar — quem cadastra é o adulto responsável.
        </p>
        <p>
          Se você é responsável por uma criança cadastrada por outro adulto e quer que os dados
          dela saiam do app, escreva para {CONTROLADOR.contato}.
        </p>
      </Secao>

      <Secao title="Quando esta política mudar">
        <p>
          Cada versão tem número e data. Se a mudança for relevante — algo novo que passamos a
          guardar, ou alguém novo que passa a ver —, avisamos por e-mail os adultos das casas
          ativas antes de a versão nova valer.
        </p>
      </Secao>
    </LegalPage>
  );
}

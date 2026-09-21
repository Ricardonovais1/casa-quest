# Casa Quest

> Responsabilidade não se compra. Se cultiva.

App para famílias com crianças e adolescentes. O adulto (**Guardião-Mor**) monta a casa: cadastra os
**Guardiões**, convida os outros adultos como **Conselheiros** (confirmam ações, registram tropeços e extras,
acompanham a energia; decidem regras e mesada só com "poderes iguais"), escolhe as ações (hábitos, colaboração, tropeços, missões extras, escaladas) e cria
**missões** (períodos com mesada-alvo). Cada guardião recebe um **link próprio** (sem senha), vê as ações
do dia, marca "Fiz!" e registra as próprias **missões extras** sem esperar aprovação. Faltas, constância e
missões extras viram uma **energia de compromisso** que, no fim da missão, sugere a mesada. Os guardiões
nunca veem dinheiro. Quando alguém fica abaixo da meta, os adultos recebem um e-mail com o que fazer.

## Stack

- Next.js 16 (App Router, `proxy.ts`) · React 19 · Tailwind 4
- Supabase (Postgres + Auth). Guardião-Mor usa sessão; guardiões usam token na URL.
- Vercel (deploy + cron diário)

## Rodando localmente

```bash
cp .env.local.example .env.local   # preencha as chaves do Supabase
npm install
npm run dev                        # http://localhost:3000
```

Checagens:

```bash
npx tsc --noEmit      # tipos
npm run lint          # eslint
npx jest              # testes unitários (domínio + libs)
npx tsx scripts/verify-family-flow.ts   # fluxo ponta a ponta contra o banco (cria e apaga uma família de teste)
```

## Banco de dados

Migrações em `supabase/migrations/`, em ordem. Para aplicar:

```bash
# com um personal access token do Supabase (Account → Access Tokens)
SUPABASE_TOKEN=sbp_xxx node scripts/apply-migration.mjs 00006 00007 00008 00009 00010
# ou cole o SQL no SQL Editor do painel do Supabase
```

| Migração | O que faz |
| --- | --- |
| 00001–00005 | Esquema inicial, categorias, pontos, distribuição, token do guardião |
| 00006 | Índice único da geração diária (idempotência), índice de status, frequência padrão |
| 00007 | **RLS completo** — cada família só enxerga os próprios dados. Obrigatória antes de abrir para outras famílias. |
| 00008 | **Papéis** — Conselheiro(a), gênero para rótulos, "poderes iguais", mesada visível a conselheiros, políticas por papel. Requer a 00007. |
| 00009 | **Horário opcional** — `families.day_end_time` (fim do dia, 22:00) e `action_templates.default_due_time` passa a aceitar NULL ("sem hora marcada"); limpa as ações que estavam no 20:00 do catálogo. |
| 00010 | **Alertas e autonomia** — limite de energia por família, tabela `performance_alerts` (histórico de avisos, evita repetição) e `mission_actions.recorded_by_guardian_id` (quem registrou a missão extra). Requer a 00008. |

## E-mails transacionais

Dois e-mails saem do app, os dois pelo SMTP configurado em `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASS` e `SMTP_FROM` (veja `.env.local.example`). Há ainda o **`SMTP_REPLY_TO`**, opcional: o
remetente é um endereço do domínio verificado, que pode não ter caixa de entrada — sem ele, quem
responde ao convite fala com o vazio. Com ele, a resposta vai para uma caixa que existe:

- **Convite de Conselheiro(a)** — ao convidar um adulto em Família, o app gera o link de aceite pela
  Admin API do Supabase e manda o e-mail por conta própria. Sem SMTP configurado, cai no envio embutido
  do Supabase (poucos e-mails por hora). Se o envio falhar, o convite fica gravado e a tela mostra o link
  para compartilhar à mão.
- **Alerta de desempenho** — quando um guardião fica com energia **igual ou abaixo de 70%** da meta
  (ajustável em Configurações), os adultos da casa recebem um e-mail acolhedor: o retrato da missão,
  o que dá para fazer no app (registrar missões extras, começar pequeno, revisar horários) e o que fazer
  em casa (revisar a rotina junto, alinhar horários entre os adultos, escuta ativa). O guardião não recebe
  nada e nunca vê valores.

  A checagem roda no cron diário, depois da varredura de faltas. Cada guardião recebe no máximo um aviso
  a cada três dias por missão — o histórico fica em `performance_alerts`. Em Configurações há um botão
  **"Checar e enviar agora"** (`POST /api/alerts/performance`) para rodar a checagem na hora.

### Conferindo o SMTP

O botão "Checar e enviar agora" só envia quando alguém está de fato abaixo da meta — com a casa em dia,
uma senha errada passaria despercebida. Para provar o caminho inteiro (transporte + modelos):

```bash
npx tsx scripts/send-test-email.ts voce@exemplo.com   # manda os dois e-mails
npx tsx scripts/send-test-email.ts --dry              # só mostra o que sairia
```

Ele lê o `.env.local`, e o que estiver definido no shell ganha do arquivo — dá para testar uma
configuração sem gravar nada em disco. Para conferir a de produção, defina as variáveis à mão com os
mesmos valores da Vercel: `vercel env pull` **não** serve, porque variável do tipo Secret/Sensitive
volta como `[SENSITIVE]` em vez do valor.

**Com Resend**: `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_USER=resend` (literalmente),
`SMTP_PASS` = a API key (`re_…`) e `SMTP_FROM` num domínio verificado lá. Variável nova na Vercel só
vale depois de um novo deploy — `NEXT_PUBLIC_APP_URL` ainda mais, porque vai embutida no bundle do
cliente em tempo de build.

**`550 The … domain is not verified`**: o domínio de `SMTP_FROM` não está verificado **no time do Resend dono
da API key**. A mesma mensagem vale para domínio pendente e para domínio que nem está cadastrado — e registros
DNS publicados não provam cadastro: sobram de um domínio apagado ou de outra conta. Em resend.com/domains (no
time certo), **Add Domain** se ele não estiver na lista, com a mesma região dos registros que já existem (o MX de
`send.` diz a região: `feedback-smtp.sa-east-1…` = São Paulo). A chave DKIM (`resend._domainkey`) muda a cada
cadastro: substitua o valor no DNS, não crie um segundo registro. Depois, **Verify**. A tela de Família mostra esse e os outros erros
conhecidos em português (`explainSendError` em `src/lib/email/mailer.ts`), sempre com o link de aceite como
plano B.

## Como o dia funciona

1. **Geração** — para a missão ativa, `syncFamilyDay` cria as `mission_actions` de hoje: hábitos para todos
   os guardiões; atividades de colaboração só para quem está com elas na distribuição do período; a
   frequência ("diária", "3×/semana"…) define os dias. Eventos extras não têm horário — alguém registra
   quando acontecem, no painel **Hoje**.
2. **Horário** — por padrão a ação não tem hora marcada: vale o dia todo e o `due_at` cai no
   `day_end_time` da família (22:00). Quem quiser marca uma hora na ação, e aí valem o horário e a
   tolerância da casa.
3. **Faltas** — uma ação pendente vira falta depois de `due_at + tolerância` quando tem hora marcada, e
   no fim do dia quando não tem (o fim do dia já é o limite, não soma tolerância). Se foi gerada
   atrasada, o guardião ganha pelo menos uma hora a partir da geração.
4. **Mudou no meio do dia?** — trocar a distribuição, marcar uma hora numa ação ou mudar o fim do dia
   reacerta o que ainda está pendente hoje; o que já foi feito ou virou falta fica como está.
5. **Encerramento** — no dia seguinte ao fim da missão, energia final e mesada sugerida são gravadas em
   `mission_guardians` e a missão fica `completed`.

### Eventos extras: dois, e só dois

Fora do ciclo diário existem **tropeço** e **missão extra** — "missão extra" e "escalada" eram dois botões
para a mesma ideia e viraram um conceito só (`src/lib/extra-events.ts`). O efeito na energia sai da
categoria da ação, não de uma escolha de quem registra: categoria `missoes` compensa a falta mais antiga
ainda em aberto; `gentilezas`, `autoaperfeicoamento` e `rendimento_escolar` somam energia, podendo passar
de 100.

- **Missão extra** — qualquer adulto registra em **Hoje**, e o **próprio guardião** registra pelo link dele
  (`POST /api/g/[token]/extras`), sem esperar aprovação. Entra já confirmada.
- **Tropeço** — só adultos da casa, no painel **Hoje**. O guardião não registra falta, nem contra si.

Isso roda ao abrir o painel do Mor, ao abrir o link de um guardião e todo dia às 00:05 (São Paulo) pelo
cron da Vercel (`/api/cron/daily`, protegido por `CRON_SECRET`).

### Ações repetidas: achar e fundir

O catálogo junta repetições com o tempo ("Colocar louça" do catálogo pronto e "Encher a lava-louça" criada à
mão). Em **Ações**, o card **Ações parecidas** lista os pares (`src/domain/actions/similarity.ts`: compara os
nomes sem acento e plural, com sinônimos de tarefa de casa, e não junta opostos como colocar/tirar a mesa).
Cada par tem **Fundir…** ou **Não são iguais** (guardado no aparelho). Também dá para fundir a partir das
configurações de uma ação.

Na fusão (`POST /api/action-templates/merge`) a pessoa escolhe **qual fica valendo** (categoria, pontos,
frequência, horário) e **o nome**. A que sai entrega o histórico e a rodada da distribuição para a que fica e
some do catálogo. Onde as duas caíam no mesmo dia para a mesma pessoa, a pendência repetida sai e os registros
já feitos ou perdidos ficam todos. Só se fundem ações do mesmo grupo: do dia (hábito/colaboração), tropeços ou
missões extras.

### Revisão da divisão

Em **Distribuição**, o card **Revisão da divisão** (`src/domain/distribution/review.ts`) confere a rodada vigente
contra o catálogo e sugere ajustes pontuais, sem sortear tudo de novo (`POST /api/families/distribution` com
`mode: 'patch'`, que mantém as datas da rodada):

- **Trocar** — alguém está com uma tarefa repetida (igual a um hábito que já faz, ou à de outra pessoa) e há
  atividade sem ninguém: essa pessoa larga a repetida e pega a que faltava, e a carga dela quase não muda.
- **Atribuir** — atividade sem ninguém e nenhuma repetida para trocar: vai para quem está com menos pontos
  (dá para escolher outra pessoa).
- **Fundir** — a atividade sem ninguém é a mesma de outra que já está no dia de alguém, ou a mesma pessoa faz a
  mesma tarefa duas vezes: leva para a fusão em Ações.

## Textos legais e cópias de segurança

Os **Termos de Uso** (`/termos`) e a **Política de Privacidade** (`/privacidade`) saem de
`src/lib/legal.ts`, que guarda a identidade jurídica, as versões e os prazos. A política foi escrita
contra o esquema real, tabela a tabela — **se uma coluna nova passar a guardar algo sobre uma
pessoa, a página muda junto**. Texto de versão já publicada não se edita: muda-se o número e a data,
porque o aceite que for gravado no futuro aponta para a versão que a pessoa realmente leu. Os dois
faltam revisão de advogado, e o comentário no topo de cada arquivo diz isso.

O plano gratuito do Supabase não faz backup automático. `scripts/backup-db.ts` baixa todas as
tabelas pela API REST (as tabelas são descobertas sozinhas, para uma nova não ficar de fora) e grava
um JSON por tabela:

```bash
npx tsx scripts/backup-db.ts            # grava em ./backups/<data-hora>/
npx tsx scripts/backup-db.ts --dry      # só conta as linhas
npx tsx scripts/backup-db.ts --out D:/copias
```

A pasta `backups/` está no `.gitignore` — **este repositório é público**, e ali dentro vão nomes de
crianças e o histórico do dia delas. Nunca commitar, nunca subir como artefato de CI. O script apaga
sozinho as cópias com mais de 90 dias, que é o prazo prometido na política.

Para testar telas com dados realistas sem tocar na família de verdade, `scripts/seed-test-family.ts`
cria uma casa descartável (com o caso das ações repetidas já plantado) e `--delete` apaga tudo.

## Configuração do Supabase (Auth)

- **Site URL**: `https://casaquest.fun`
- **Redirect URLs**: `https://www.casaquest.fun/**`, `https://casaquest.fun/**`, `https://*.vercel.app/**`,
  `http://localhost:3000/**` (cobre `/api/auth/callback` e `/convite`)
- Confirmação de e-mail está ligada: o signup mostra "confira seu e-mail" e o link leva ao onboarding.
- Para receber várias famílias, configure um **SMTP próprio** também no Supabase (Auth → SMTP): confirmação
  de cadastro e redefinição de senha saem por lá. O SMTP embutido limita a poucos e-mails por hora.
  O convite de conselheiro e o alerta de energia não dependem disso — saem pelo SMTP do app (`SMTP_*`).

## Estrutura

```
src/
  app/                 páginas e rotas de API
    dashboard/         painel do Guardião-Mor (hoje, família, ações, distribuição, missões, energia, config)
    g/[token]/         tela do guardião (acesso por link)
    api/               rotas (sync do dia, cron, missões, decisões sobre ações, energia, tokens)
  domain/              regras puras (energia, distribuição, recompensa, quórum, cooperação, alertas) — testadas
  lib/                 I/O sobre o Supabase (ciclo diário, energia, distribuição, agenda, fuso, extras)
    email/             SMTP e modelos de e-mail (convite, alerta de desempenho)
  components/          UI
supabase/migrations/   esquema e políticas
scripts/               utilitários de operação (migrações, verificação, links, teste de SMTP)
```

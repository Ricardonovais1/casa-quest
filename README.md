# Casa Quest

> Responsabilidade não se compra. Se cultiva.

App para famílias com crianças e adolescentes. O adulto (**Guardião-Mor**) monta a casa: cadastra os
**Guardiões**, convida os outros adultos como **Conselheiros** (confirmam ações, registram tropeços e extras,
acompanham a energia; decidem regras e mesada só com "poderes iguais"), escolhe as ações (hábitos, colaboração, tropeços, missões extras, escaladas) e cria
**missões** (períodos com mesada-alvo). Cada guardião recebe um **link próprio** (sem senha), vê as ações
do dia e marca "Fiz!". Faltas, constância, recuperação e escalada viram uma **energia de compromisso**
que, no fim da missão, sugere a mesada. Os guardiões nunca veem dinheiro.

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
SUPABASE_TOKEN=sbp_xxx node scripts/apply-migration.mjs 00006 00007 00008
# ou cole o SQL no SQL Editor do painel do Supabase
```

| Migração | O que faz |
| --- | --- |
| 00001–00005 | Esquema inicial, categorias, pontos, distribuição, token do guardião |
| 00006 | Índice único da geração diária (idempotência), índice de status, frequência padrão |
| 00007 | **RLS completo** — cada família só enxerga os próprios dados. Obrigatória antes de abrir para outras famílias. |
| 00008 | **Papéis** — Conselheiro(a), gênero para rótulos, "poderes iguais", mesada visível a conselheiros, políticas por papel. Requer a 00007. |

## Como o dia funciona

1. **Geração** — para a missão ativa, `syncFamilyDay` cria as `mission_actions` de hoje: hábitos para todos
   os guardiões; atividades de colaboração só para quem está com elas na distribuição do período; a
   frequência ("diária", "3×/semana"…) define os dias. Tropeços, missões extras e escaladas não têm horário:
   o Mor registra quando acontecem, no painel **Hoje**.
2. **Faltas** — uma ação pendente vira falta depois de `due_at + tolerância` (se foi gerada atrasada, o
   guardião ganha a tolerância a partir da geração).
3. **Encerramento** — no dia seguinte ao fim da missão, energia final e mesada sugerida são gravadas em
   `mission_guardians` e a missão fica `completed`.

Isso roda ao abrir o painel do Mor, ao abrir o link de um guardião e todo dia às 00:05 (São Paulo) pelo
cron da Vercel (`/api/cron/daily`, protegido por `CRON_SECRET`).

## Configuração do Supabase (Auth)

- **Site URL**: `https://casaquest.fun`
- **Redirect URLs**: `https://www.casaquest.fun/**`, `https://casaquest.fun/**`, `https://*.vercel.app/**`,
  `http://localhost:3000/**` (cobre `/api/auth/callback` e `/convite`)
- Confirmação de e-mail está ligada: o signup mostra "confira seu e-mail" e o link leva ao onboarding.
- Para receber várias famílias, configure um **SMTP próprio** (Auth → SMTP). O SMTP embutido do Supabase
  limita a poucos e-mails por hora.

## Estrutura

```
src/
  app/                 páginas e rotas de API
    dashboard/         painel do Guardião-Mor (hoje, família, ações, distribuição, missões, energia, config)
    g/[token]/         tela do guardião (acesso por link)
    api/               rotas (sync do dia, cron, missões, decisões sobre ações, energia, tokens)
  domain/              regras puras (energia, distribuição, recompensa, quórum, cooperação) — 100% testadas
  lib/                 I/O sobre o Supabase (ciclo diário, energia, distribuição, agenda, fuso)
  components/          UI
supabase/migrations/   esquema e políticas
scripts/               utilitários de operação (migrações, verificação, links)
```

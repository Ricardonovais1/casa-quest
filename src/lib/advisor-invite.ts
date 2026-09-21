// ============================================================
// Casa Quest — Lib: Convite do Conselheiro
//
// DECISION (2026-09-20): o convite deixou de ser um magic link do
// Supabase e passou a ser um link nosso, com token durável — o mesmo
// padrão dos links dos guardiões (`/g/<token>`).
//
// POR QUÊ: o magic link entrega a sessão no FRAGMENTO da URL
// (`/convite#access_token=…`) e só serve uma vez. Isso quebra de três
// jeitos, todos observados nesta casa:
//   1. quem abre o e-mail num navegador embutido (Gmail no celular) nem
//      sempre consegue gravar o cookie da sessão — a página abre sem
//      sessão e vira beco sem saída;
//   2. qualquer pré-carregamento do link (antivírus, scanner de e-mail)
//      queima o token antes da pessoa clicar;
//   3. consumir o token marca `email_confirmed_at`/`last_sign_in_at` em
//      auth.users SEM criar senha nenhuma. A conselheira desta casa
//      ficou assim: "confirmada" para o Supabase, sem senha para entrar,
//      e o app ainda dizia ao Mor "ela já tem conta, é só usar a senha
//      de sempre". Todas as saídas da tela levavam a criar OUTRA família.
//
// O token durável não tem nenhum desses problemas: é uma URL comum, abre
// em qualquer navegador, pode ser reaberta, e a conta só é criada quando
// a pessoa define a senha — momento em que ela já entra ligada à família.
//
// O token mora nas colunas que já existem (`access_token`,
// `access_token_hash`, `token_expires_at`), então não precisa de
// migração. Quem resolve token de criança recusa adulto e vice-versa.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { isEmailConfigured, sendEmail } from './email/mailer';
import { advisorInviteEmail } from './email/templates';
import { hashGuardianToken } from './guardian-token';
import { roleLabel, roleOf, type Gender } from './roles';

/** Quanto tempo o link de convite vale. */
export const INVITE_TTL_DAYS = 14;

/** Em que pé está o acesso de um adulto convidado. */
export type InviteState =
  /** Já definiu a senha por este fluxo e está ligado à família. */
  | 'active'
  /** Tem um convite em aberto — o link ainda vale. */
  | 'pending'
  /** Nunca foi convidado. */
  | 'none';

export type InviteChannel = 'sent' | 'not_sent';

export interface InviteDelivery {
  channel: InviteChannel;
  /** O estado ANTES desta tentativa. */
  state: InviteState;
  /**
   * O link de aceite. Diferente do magic link, este SEMPRE volta: ele não
   * queima ao ser aberto, então serve de plano B por WhatsApp sem risco.
   */
  inviteUrl: string;
  /** Por que o e-mail não saiu, quando não saiu. */
  reason: string | null;
}

/** O que o convite precisa saber de um adulto da casa. */
export interface AdvisorRow {
  id: string;
  name: string;
  email: string | null;
  user_id?: string | null;
  access_token_hash?: string | null;
  token_expires_at?: string | null;
  role?: string | null;
  is_mor?: boolean | null;
  gender?: Gender;
}

function tokenAlive(advisor: AdvisorRow): boolean {
  if (!advisor.access_token_hash) return false;
  if (!advisor.token_expires_at) return true;
  return new Date(advisor.token_expires_at) > new Date();
}

/**
 * Em que pé está o convite — lido dos NOSSOS dados, não de auth.users.
 *
 * DECISION (2026-09-20): antes isto era deduzido de
 * `email_confirmed_at`/`last_sign_in_at`. Não serve: abrir um magic link
 * marca os dois sem criar senha, e a pessoa aparecia como "ativa" sem
 * conseguir entrar. Aceitar é um ato nosso — a senha definida em
 * `/convite/<token>`, que liga `user_id` e apaga o token.
 */
export function inviteStateOf(advisor: AdvisorRow | null | undefined): InviteState {
  if (!advisor) return 'none';
  if (tokenAlive(advisor)) return 'pending';
  return advisor.user_id ? 'active' : 'none';
}

export function buildInviteUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/convite/${token}`;
}

export interface MintedInvite {
  token: string;
  url: string;
  expiresAt: string;
}

/**
 * Gera um convite novo para este adulto e grava na linha dele.
 * Um convite novo invalida o anterior: só um link vale por vez.
 */
export async function mintInviteToken(
  db: SupabaseClient,
  advisorId: string,
  baseUrl: string
): Promise<MintedInvite> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  await db
    .from('guardians')
    .update({
      access_token: token,
      access_token_hash: await hashGuardianToken(token),
      token_expires_at: expiresAt,
    })
    .eq('id', advisorId);

  return { token, url: buildInviteUrl(baseUrl, token), expiresAt };
}

/** Conselheiro resolvido a partir do token, com o que a tela precisa. */
export interface InviteAdvisor extends AdvisorRow {
  family_id: string;
  email: string;
}

export type InviteLookup =
  | { ok: true; advisor: InviteAdvisor }
  | { ok: false; reason: 'not_found' | 'expired' | 'no_email' };

/**
 * Resolve um token de convite para o conselheiro dono dele.
 *
 * Exige service role: quem abre o link ainda não tem sessão nenhuma — o
 * token É a credencial. Recusa guardião (criança): o link da criança é
 * `/g/<token>` e os dois mundos não se misturam, mesmo dividindo coluna.
 */
export async function resolveInviteToken(
  db: SupabaseClient,
  token: string
): Promise<InviteLookup> {
  const { data: advisor } = await db
    .from('guardians')
    .select('id, family_id, name, email, user_id, role, is_mor, gender, token_expires_at, access_token_hash')
    .eq('access_token_hash', await hashGuardianToken(token))
    .eq('is_active', true)
    .maybeSingle();

  if (!advisor || roleOf(advisor) === 'guardiao') return { ok: false, reason: 'not_found' };
  if (advisor.token_expires_at && new Date(advisor.token_expires_at) < new Date()) {
    return { ok: false, reason: 'expired' };
  }
  if (!advisor.email) return { ok: false, reason: 'no_email' };

  return { ok: true, advisor: advisor as InviteAdvisor };
}

export interface DeliverInviteParams {
  advisor: AdvisorRow & { email: string };
  inviterName: string;
  familyName: string;
  /** Base pública do app (vem de `appUrl(request)`). */
  baseUrl: string;
}

/**
 * Gera o link de aceite e manda por e-mail.
 *
 * DECISION (2026-09-20): manda SEMPRE, sem tentar adivinhar se a pessoa
 * "já tem conta". O palpite anterior errava justamente no caso que
 * importa (conta criada por um convite que ela nunca conseguiu usar) e
 * deixava o Mor sem nenhuma ação possível. Mandar o link para alguém que
 * já tem acesso não custa nada: é o endereço dela, e ela só troca a
 * própria senha.
 *
 * Nunca lança. O e-mail é o melhor esforço; o link devolvido é a garantia.
 */
export async function deliverAdvisorInvite(
  db: SupabaseClient,
  params: DeliverInviteParams
): Promise<InviteDelivery> {
  const state = inviteStateOf(params.advisor);
  const minted = await mintInviteToken(db, params.advisor.id, params.baseUrl);

  if (!isEmailConfigured()) {
    return {
      channel: 'not_sent',
      state,
      inviteUrl: minted.url,
      reason: 'SMTP não configurado (defina SMTP_HOST e SMTP_FROM).',
    };
  }

  const { subject, html } = advisorInviteEmail({
    inviterName: params.inviterName,
    familyName: params.familyName,
    inviteeName: params.advisor.name,
    acceptUrl: minted.url,
    roleLabel: roleLabel({ role: 'conselheiro', gender: params.advisor.gender }),
  });
  const sent = await sendEmail({ to: params.advisor.email, subject, html });

  return sent.ok
    ? { channel: 'sent', state, inviteUrl: minted.url, reason: null }
    : {
        channel: 'not_sent',
        state,
        inviteUrl: minted.url,
        reason: sent.hint ?? sent.message,
      };
}

/** Mensagem que o Mor lê, já sabendo se era um primeiro envio ou reenvio. */
export function inviteMessage(
  delivery: InviteDelivery,
  name: string,
  email: string
): string {
  const again = delivery.state === 'none' ? '' : ' de novo';
  if (delivery.channel === 'sent') {
    return `Convite enviado${again} para ${email}. ${name} define a senha pelo link do e-mail e já entra na família.`;
  }
  return `O e-mail para ${email} não saiu. Copie o link abaixo e mande para ${name} por onde for mais fácil — ele continua valendo.`;
}

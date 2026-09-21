// ============================================================
// Casa Quest — API: Adultos da casa (Conselheiros)
// GET  /api/families/adults          → adultos + em que pé está o convite
// POST /api/families/adults  { name, email, gender? }
//
// Convida um segundo adulto. Se o e-mail já tem conta USÁVEL no Casa Quest,
// liga na hora; senão manda o convite (SMTP da casa, ou o envio embutido do
// Supabase) e devolve o link de aceite como plano B.
//
// Convidar de novo alguém que já está na família não é erro: é reenvio.
// Só quem gerencia a casa convida.
// ============================================================

import { NextResponse } from 'next/server';
import { requireAdult, apiError } from '@/lib/require-mor';
import { appUrl } from '@/lib/app-url';
import { deliverAdvisorInvite, inviteMessage, inviteStateOf } from '@/lib/advisor-invite';
import { roleOf } from '@/lib/roles';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Adultos da casa com o estado real do convite de cada um. */
export async function GET() {
  const auth = await requireAdult();
  if (!auth.ok) return auth.response;
  const { db, me } = auth.ctx;

  const { data: rows } = await db
    .from('guardians')
    .select('*')
    .eq('family_id', me.family_id)
    .eq('is_active', true);

  const adults = (rows ?? []).filter((g) => roleOf(g) !== 'guardiao');

  // O estado do convite sai da própria linha do guardião (token em aberto
  // vs. vínculo já feito), não de auth.users — ver `lib/advisor-invite`.
  return NextResponse.json({
    data: {
      adults: adults.map((g) => ({
        id: g.id,
        name: g.name,
        email: g.email,
        role: roleOf(g),
        inviteState: inviteStateOf(g),
        invitedAt: g.token_expires_at ?? null,
      })),
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireAdult({ manage: true });
  if (!auth.ok) return auth.response;
  const { db, me } = auth.ctx;

  const body = (await request.json().catch(() => null)) as
    | { name?: string; email?: string; gender?: 'm' | 'f' | null }
    | null;

  const name = body?.name?.trim() ?? '';
  const email = body?.email?.trim().toLowerCase() ?? '';
  const gender = body?.gender === 'm' || body?.gender === 'f' ? body.gender : null;

  if (!name || name.length > 100) return apiError('VALIDATION_ERROR', 'Informe o nome', 400);
  if (!EMAIL_RE.test(email)) return apiError('VALIDATION_ERROR', 'E-mail inválido', 400);

  // One family per e-mail (guardians.email is unique).
  const { data: existing } = await db
    .from('guardians')
    .select('id, family_id, name, email, gender, user_id, role, is_mor, access_token_hash, token_expires_at')
    .eq('email', email)
    .maybeSingle();
  if (existing && existing.family_id !== me.family_id) {
    return apiError('EMAIL_TAKEN', 'Este e-mail já pertence a outra família no Casa Quest.', 409);
  }

  const { data: family } = await db
    .from('families')
    .select('name')
    .eq('id', me.family_id)
    .maybeSingle();
  const familyName = family?.name ?? 'sua família';

  // A linha tem de existir ANTES do convite: o token de aceite é gravado
  // nela. Já estar na família não é erro — é reenvio.
  let advisor = existing;
  if (!advisor) {
    const { data: row, error } = await db
      .from('guardians')
      .insert({
        family_id: me.family_id,
        name,
        email,
        is_mor: false,
        role: 'conselheiro',
        gender,
        is_active: true,
      })
      .select('id, family_id, name, email, gender, user_id, role, is_mor, access_token_hash, token_expires_at')
      .single();

    if (error) {
      if (/column .*role|column .*gender/i.test(error.message)) {
        return apiError('MIGRATION_REQUIRED', 'Aplique a migração 00008 (papéis) antes de convidar adultos.', 500);
      }
      return apiError('DB_ERROR', error.message, 500);
    }
    advisor = row;
  }

  const delivery = await deliverAdvisorInvite(db, {
    advisor: { ...advisor, email },
    inviterName: me.name,
    familyName,
    baseUrl: appUrl(request),
  });

  return NextResponse.json(
    {
      data: {
        id: advisor.id,
        resent: !!existing,
        invited: delivery.channel === 'sent',
        channel: delivery.channel,
        inviteState: delivery.state,
        message: inviteMessage(delivery, advisor.name ?? name, email),
        inviteUrl: delivery.inviteUrl,
        ...(delivery.channel === 'not_sent' ? { emailError: delivery.reason } : {}),
      },
    },
    { status: existing ? 200 : 201 }
  );
}

// ============================================================
// Casa Quest — API: Aceite do convite de conselheiro
// GET  /api/convite/[token]  → de quem é o convite (para a tela)
// POST /api/convite/[token]  { password, name? } → cria a senha e entra
//
// O token é a credencial: quem abre o link ainda não tem conta nenhuma.
// Por isso roda com service role, e tudo o que ele permite é definir a
// senha do e-mail que o Mor convidou — dentro da família que convidou.
//
// Aceitar é um ato único: o token é apagado no fim. Um link vazado para
// de funcionar assim que a pessoa entra.
// ============================================================

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/infrastructure/supabase/server';
import { resolveInviteToken, type InviteAdvisor } from '@/lib/advisor-invite';
import { findAuthUser } from '@/lib/auth-users';
import { roleLabel } from '@/lib/roles';

const MIN_PASSWORD = 6;

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** Recado único para link que não serve mais, seja qual for o motivo. */
function deadLink(reason: 'not_found' | 'expired' | 'no_email') {
  return fail(
    reason === 'expired' ? 'INVITE_EXPIRED' : 'INVITE_NOT_FOUND',
    reason === 'expired'
      ? 'Este convite venceu. Peça ao Guardião-Mor para enviar outro.'
      : 'Este convite não existe mais. Peça ao Guardião-Mor para enviar outro.',
    404
  );
}

async function load(token: string) {
  const db = await createServiceClient();
  const found = await resolveInviteToken(db, token);
  if (!found.ok) return { error: deadLink(found.reason) };

  const { data: family } = await db
    .from('families')
    .select('name')
    .eq('id', found.advisor.family_id)
    .maybeSingle();

  return { db, advisor: found.advisor, familyName: family?.name ?? 'sua família' };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const loaded = await load(token);
  if (loaded.error) return loaded.error;

  return NextResponse.json({
    data: {
      name: loaded.advisor.name,
      email: loaded.advisor.email,
      familyName: loaded.familyName,
      roleLabel: roleLabel(loaded.advisor),
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const loaded = await load(token);
  if (loaded.error) return loaded.error;
  const { db, advisor } = loaded as { db: Awaited<ReturnType<typeof createServiceClient>>; advisor: InviteAdvisor };

  const body = (await request.json().catch(() => null)) as
    | { password?: string; name?: string }
    | null;

  const password = body?.password ?? '';
  const name = body?.name?.trim() || advisor.name;

  if (password.length < MIN_PASSWORD) {
    return fail('VALIDATION_ERROR', `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`, 400);
  }
  if (name.length > 100) {
    return fail('VALIDATION_ERROR', 'Nome longo demais.', 400);
  }

  // A conta pode já existir: um convite antigo do Supabase criava o
  // usuário mesmo sem ninguém conseguir usá-lo. Nesse caso é a senha
  // dele que passa a valer, e o e-mail fica confirmado de uma vez.
  const existing = await findAuthUser(db, advisor.email);
  let userId: string;

  if (existing) {
    const { error } = await db.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { ...existing.user_metadata, full_name: name, role: 'conselheiro' },
    });
    if (error) return fail('AUTH_ERROR', error.message, 500);
    userId = existing.id;
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email: advisor.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, role: 'conselheiro' },
    });
    if (error || !data.user) {
      return fail('AUTH_ERROR', error?.message ?? 'Não foi possível criar a conta.', 500);
    }
    userId = data.user.id;
  }

  // O vínculo com a família e a queima do token são a mesma escrita: se
  // isto falhar, o convite continua de pé para uma segunda tentativa.
  const { error: linkError } = await db
    .from('guardians')
    .update({
      user_id: userId,
      name,
      access_token: null,
      access_token_hash: null,
      token_expires_at: null,
    })
    .eq('id', advisor.id);

  if (linkError) return fail('DB_ERROR', linkError.message, 500);

  return NextResponse.json({ data: { email: advisor.email, familyId: advisor.family_id } });
}

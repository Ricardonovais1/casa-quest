// ============================================================
// Casa Quest — API: Adultos da casa (Conselheiros)
// POST /api/families/adults  { name, email, gender? }
//
// Convida um segundo adulto. Se o e-mail já tem conta no Casa Quest,
// liga na hora; senão, o Supabase manda um convite e a pessoa define a
// senha em /convite. Só quem gerencia a casa convida.
// ============================================================

import { NextResponse } from 'next/server';
import { requireAdult, apiError } from '@/lib/require-mor';

function baseUrl(request: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env && !/^https?:\/\/localhost\b/i.test(env)) return env.replace(/\/+$/, '');
  const proto = request.headers.get('x-forwarded-proto') || 'http';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  return host ? `${proto}://${host}` : env || 'http://localhost:3000';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    .select('id, family_id')
    .eq('email', email)
    .maybeSingle();
  if (existing && existing.family_id !== me.family_id) {
    return apiError('EMAIL_TAKEN', 'Este e-mail já pertence a outra família no Casa Quest.', 409);
  }
  if (existing) {
    return apiError('ALREADY_MEMBER', 'Esta pessoa já faz parte da sua família.', 409);
  }

  // Already has an account? Link immediately, no e-mail needed.
  let userId: string | null = null;
  let invited = false;
  const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const match = users?.users.find((u) => u.email?.toLowerCase() === email);
  if (match) {
    userId = match.id;
  } else {
    const { data: invite, error: inviteError } = await db.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${baseUrl(request)}/convite`,
      data: { full_name: name, role: 'conselheiro' },
    });
    if (inviteError) {
      return apiError('INVITE_FAILED', `Não foi possível enviar o convite: ${inviteError.message}`, 500);
    }
    userId = invite.user?.id ?? null;
    invited = true;
  }

  const { data: row, error } = await db
    .from('guardians')
    .insert({
      family_id: me.family_id,
      name,
      email,
      user_id: userId,
      is_mor: false,
      role: 'conselheiro',
      gender,
      is_active: true,
    })
    .select('id')
    .single();

  if (error) {
    if (/column .*role|column .*gender/i.test(error.message)) {
      return apiError('MIGRATION_REQUIRED', 'Aplique a migração 00008 (papéis) antes de convidar adultos.', 500);
    }
    return apiError('DB_ERROR', error.message, 500);
  }

  return NextResponse.json(
    {
      data: {
        id: row.id,
        invited,
        message: invited
          ? `Convite enviado para ${email}. A pessoa define a senha pelo link do e-mail.`
          : `${name} já tinha conta no Casa Quest e agora faz parte da família. Basta entrar com o e-mail e a senha de sempre.`,
      },
    },
    { status: 201 }
  );
}

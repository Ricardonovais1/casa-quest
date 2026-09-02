// ============================================================
// Casa Quest — API: liga a conta logada a um convite pendente
// POST /api/auth/claim
//
// Um adulto convidado por e-mail tem um registro de guardião com o
// e-mail e sem user_id. No primeiro login (ou ao abrir /convite), o
// registro passa a apontar para a conta. Roda com service role porque,
// com RLS, a pessoa ainda não "pertence" à família na hora do claim.
// ============================================================

import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/infrastructure/supabase/server';

export async function POST() {
  const session = await createServerSupabaseClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ data: { claimed: false, member: false } }, { status: 401 });
  }

  const db = await createServiceClient();

  // Already a member?
  const { data: mine } = await db
    .from('guardians')
    .select('id, family_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (mine) {
    return NextResponse.json({ data: { claimed: false, member: true, familyId: mine.family_id } });
  }

  const { data: pending } = await db
    .from('guardians')
    .select('id, family_id')
    .ilike('email', user.email)
    .is('user_id', null)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!pending) {
    return NextResponse.json({ data: { claimed: false, member: false } });
  }

  const { error } = await db
    .from('guardians')
    .update({ user_id: user.id })
    .eq('id', pending.id);
  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: { claimed: true, member: true, familyId: pending.family_id } });
}

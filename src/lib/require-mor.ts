// ============================================================
// Casa Quest — Lib: Autorização do Guardião-Mor em rotas de API
//
// Resolve a sessão do Supabase para o registro de guardião-mor do
// usuário. Devolve também um service client já autorizado para agir
// dentro da família dele — as rotas verificam sempre o family_id.
// ============================================================

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createServerSupabaseClient,
  createServiceClient,
} from '@/infrastructure/supabase/server';

export interface MorContext {
  userId: string;
  mor: { id: string; family_id: string; name: string };
  /** Service-role client. Only use it scoped to `mor.family_id`. */
  db: SupabaseClient;
}

export function apiError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function requireMor(): Promise<
  { ok: true; ctx: MorContext } | { ok: false; response: NextResponse }
> {
  const session = await createServerSupabaseClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return { ok: false, response: apiError('UNAUTHORIZED', 'Não autenticado', 401) };
  }

  const { data: mor } = await session
    .from('guardians')
    .select('id, family_id, name')
    .eq('user_id', user.id)
    .eq('is_mor', true)
    .maybeSingle();

  if (!mor) {
    return {
      ok: false,
      response: apiError('NO_FAMILY', 'Complete o onboarding para criar sua família.', 403),
    };
  }

  const db = await createServiceClient();
  return { ok: true, ctx: { userId: user.id, mor, db } };
}

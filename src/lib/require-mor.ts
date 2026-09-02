// ============================================================
// Casa Quest — Lib: Autorização de adultos em rotas de API
//
// Resolve a sessão do Supabase para o registro de guardião do usuário
// (Mor ou Conselheiro) e devolve um service client já autorizado para
// agir dentro da família dele — as rotas verificam sempre o family_id.
//
//   requireAdult()                → qualquer adulto da casa
//   requireAdult({ manage: true }) → só quem decide (Mor, ou Conselheiro
//                                    com "poderes iguais")
//   requireMor()                   → atalho para requireAdult({ manage: true })
// ============================================================

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createServerSupabaseClient,
  createServiceClient,
} from '@/infrastructure/supabase/server';
import { roleOf, canManage, canSeeMoney, isAdultRole, type Role } from '@/lib/roles';

export interface AdultContext {
  userId: string;
  /** The caller's own guardian row. */
  me: { id: string; family_id: string; name: string; role: Role; gender: 'm' | 'f' | null };
  /** @deprecated alias of `me`, kept for older routes */
  mor: { id: string; family_id: string; name: string };
  family: { equal_powers: boolean; advisors_see_reward: boolean };
  canManage: boolean;
  canSeeMoney: boolean;
  /** Service-role client. Only use it scoped to `me.family_id`. */
  db: SupabaseClient;
}

export type MorContext = AdultContext;

export function apiError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function requireAdult(opts?: { manage?: boolean }): Promise<
  { ok: true; ctx: AdultContext } | { ok: false; response: NextResponse }
> {
  const session = await createServerSupabaseClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return { ok: false, response: apiError('UNAUTHORIZED', 'Não autenticado', 401) };
  }

  // select('*') so this works before migration 00008 adds role/gender.
  const { data: rows } = await session
    .from('guardians')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1);
  const row = rows?.[0] as
    | { id: string; family_id: string; name: string; is_mor: boolean; role?: string; gender?: 'm' | 'f' | null }
    | undefined;

  const role = roleOf(row);
  if (!row || !isAdultRole(role)) {
    return {
      ok: false,
      response: apiError('NO_FAMILY', 'Complete o onboarding para criar sua família.', 403),
    };
  }

  const db = await createServiceClient();
  const { data: fam } = await db
    .from('families')
    .select('*')
    .eq('id', row.family_id)
    .maybeSingle();
  const family = {
    equal_powers: !!(fam as { equal_powers?: boolean } | null)?.equal_powers,
    advisors_see_reward: (fam as { advisors_see_reward?: boolean } | null)?.advisors_see_reward !== false,
  };

  const manage = canManage(role, family);
  if (opts?.manage && !manage) {
    return {
      ok: false,
      response: apiError(
        'FORBIDDEN',
        'Só o Guardião-Mor pode fazer isso. Peça a ele, ou ligue “poderes iguais” em Configurações.',
        403
      ),
    };
  }

  const me = {
    id: row.id,
    family_id: row.family_id,
    name: row.name,
    role,
    gender: row.gender ?? null,
  };

  return {
    ok: true,
    ctx: {
      userId: user.id,
      me,
      mor: { id: me.id, family_id: me.family_id, name: me.name },
      family,
      canManage: manage,
      canSeeMoney: canSeeMoney(role, family),
      db,
    },
  };
}

/** Só quem decide (Mor, ou Conselheiro com poderes iguais). */
export async function requireMor() {
  return requireAdult({ manage: true });
}

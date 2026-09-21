// ============================================================
// Casa Quest — Lib: Guardian token authentication
//
// Guardiões (não-Mor) acessam o app por um link com token, sem login.
// Este módulo resolve o token para um guardião — é a única forma de
// autenticar essas requisições, já que não existe sessão do Supabase.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { roleOf } from './roles';

export interface TokenGuardian {
  id: string;
  name: string;
  family_id: string;
  token_expires_at: string | null;
}

export type TokenResult =
  | { ok: true; guardian: TokenGuardian }
  | { ok: false; reason: 'not_found' | 'expired' };

/** SHA-256 hex digest, matching how tokens are stored. */
export async function hashGuardianToken(token: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token)
  );
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Resolve an access token to its guardian.
 * Requires a service-role client: the caller has no Supabase session, so RLS
 * cannot identify them — the token itself is the credential.
 *
 * DECISION (2026-09-20): o convite do conselheiro usa estas mesmas colunas
 * (ver `lib/advisor-invite`), então aqui só passa CRIANÇA. Sem isso, o link
 * de convite de um adulto abriria a tela de guardião da linha dele.
 */
export async function resolveGuardianToken(
  supabase: SupabaseClient,
  token: string
): Promise<TokenResult> {
  const tokenHash = await hashGuardianToken(token);

  const { data: guardian, error } = await supabase
    .from('guardians')
    .select('id, name, family_id, token_expires_at, role, is_mor')
    .eq('access_token_hash', tokenHash)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !guardian || roleOf(guardian) !== 'guardiao') {
    return { ok: false, reason: 'not_found' };
  }

  if (
    guardian.token_expires_at &&
    new Date(guardian.token_expires_at) < new Date()
  ) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true, guardian };
}

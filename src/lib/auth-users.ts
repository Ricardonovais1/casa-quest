// ============================================================
// Casa Quest — Lib: procurar conta em auth.users
//
// O Supabase não expõe "buscar usuário por e-mail" na API de admin, só
// a listagem. Fica isolado aqui para quem precisa não repetir o truque.
// ============================================================

import type { SupabaseClient, User } from '@supabase/supabase-js';

/** Procura a conta de um e-mail em auth.users. Exige service role. */
export async function findAuthUser(
  db: SupabaseClient,
  email: string
): Promise<User | null> {
  const wanted = email.trim().toLowerCase();
  const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data?.users.find((u) => u.email?.toLowerCase() === wanted) ?? null;
}

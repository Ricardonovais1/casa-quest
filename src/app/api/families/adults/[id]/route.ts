// ============================================================
// Casa Quest — API: um adulto da casa
// PATCH  /api/families/adults/[id]  { name?, gender?, role? }
// DELETE /api/families/adults/[id]  → remove um conselheiro
//
// Só quem gerencia. O Mor não pode ser removido nem rebaixado por aqui.
// ============================================================

import { NextResponse } from 'next/server';
import { requireAdult, apiError } from '@/lib/require-mor';

async function loadAdult(id: string) {
  const auth = await requireAdult({ manage: true });
  if (!auth.ok) return { error: auth.response };
  const { db, me } = auth.ctx;
  const { data: adult } = await db
    .from('guardians')
    .select('id, name, is_mor, role, user_id')
    .eq('id', id)
    .eq('family_id', me.family_id)
    .maybeSingle();
  if (!adult) return { error: apiError('NOT_FOUND', 'Pessoa não encontrada', 404) };
  if (adult.is_mor) return { error: apiError('INVALID_TARGET', 'O Guardião-Mor não pode ser alterado por aqui', 422) };
  return { db, adult };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const loaded = await loadAdult(id);
  if (loaded.error) return loaded.error;
  const { db } = loaded;

  const body = (await request.json().catch(() => null)) as
    | { name?: string; gender?: 'm' | 'f' | null }
    | null;
  const patch: Record<string, unknown> = {};
  if (typeof body?.name === 'string' && body.name.trim()) patch.name = body.name.trim();
  if (body?.gender === 'm' || body?.gender === 'f' || body?.gender === null) patch.gender = body.gender;
  if (Object.keys(patch).length === 0) return apiError('VALIDATION_ERROR', 'Nada para alterar', 400);

  const { error } = await db.from('guardians').update(patch).eq('id', id);
  if (error) return apiError('DB_ERROR', error.message, 500);
  return NextResponse.json({ data: { id, updated: true } });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const loaded = await loadAdult(id);
  if (loaded.error) return loaded.error;
  const { db } = loaded;

  // The auth account stays (it may be used elsewhere); only the family
  // membership goes. Confirmations they signed keep pointing at the row?
  // No: the FK cascades. Deactivate instead so history survives.
  const { error } = await db
    .from('guardians')
    .update({ is_active: false, user_id: null, email: null })
    .eq('id', id);
  if (error) return apiError('DB_ERROR', error.message, 500);
  return NextResponse.json({ data: { id, removed: true } });
}

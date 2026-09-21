// ============================================================
// Casa Quest — API: fundir duas ações do catálogo
// POST /api/action-templates/merge { keepId, mergeId, name }
//
// A que sai entrega histórico, distribuição e o dia de hoje para a que
// fica, que passa a se chamar `name`. Só quem gerencia a casa funde, e
// só ações do mesmo grupo (do dia, tropeços, missões extras).
// ============================================================

import { NextResponse } from 'next/server';
import { requireAdult, apiError } from '@/lib/require-mor';
import { canMerge } from '@/domain/actions/similarity';
import { mergeActionTemplates, type MergeOutcome, type MergeTemplate } from '@/lib/action-merge';
import { syncFamilyDay } from '@/lib/daily-actions';
import { notifyFamilyChanged } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

const MAX_NAME = 120;

export async function POST(request: Request) {
  const auth = await requireAdult({ manage: true });
  if (!auth.ok) return auth.response;
  const { db, me } = auth.ctx;

  const body = (await request.json().catch(() => null)) as
    | { keepId?: unknown; mergeId?: unknown; name?: unknown }
    | null;
  const keepId = typeof body?.keepId === 'string' ? body.keepId : '';
  const mergeId = typeof body?.mergeId === 'string' ? body.mergeId : '';
  const name = typeof body?.name === 'string' ? body.name.trim() : '';

  if (!keepId || !mergeId || keepId === mergeId) {
    return apiError('VALIDATION_ERROR', 'Escolha duas ações diferentes.', 400);
  }
  if (!name) return apiError('VALIDATION_ERROR', 'Dê um nome para a ação que fica.', 400);
  if (name.length > MAX_NAME) {
    return apiError('VALIDATION_ERROR', `O nome pode ter até ${MAX_NAME} caracteres.`, 400);
  }

  const { data: rows, error } = await db
    .from('action_templates')
    .select('id, name, category, is_active')
    .eq('family_id', me.family_id)
    .in('id', [keepId, mergeId]);
  if (error) return apiError('DB_ERROR', error.message, 500);

  const pick = (id: string): MergeTemplate | null => {
    const t = rows?.find((r) => r.id === id);
    return t ? { id: t.id, name: t.name, category: t.category, is_active: t.is_active !== false } : null;
  };
  const keep = pick(keepId);
  const merge = pick(mergeId);

  if (!keep || !merge) return apiError('NOT_FOUND', 'Ação não encontrada', 404);
  if (!canMerge(keep, merge)) {
    return apiError(
      'INCOMPATIBLE',
      'Só dá para fundir ações do mesmo tipo: do dia (hábito ou colaboração) entre si, tropeço com tropeço, missão extra com missão extra.',
      422
    );
  }

  let outcome: MergeOutcome;
  try {
    outcome = await mergeActionTemplates(db, me.family_id, keep, merge, name);
  } catch (e) {
    return apiError('MERGE_FAILED', e instanceof Error ? e.message : 'Não foi possível fundir as ações.', 500);
  }

  // Hábito que virou colaboração (ou o contrário): o dia de hoje acompanha.
  await syncFamilyDay(db, me.family_id).catch(() => null);
  await notifyFamilyChanged(me.family_id, 'actions');

  return NextResponse.json({ data: { keepId, mergeId, ...outcome } });
}

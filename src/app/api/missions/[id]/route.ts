// ============================================================
// Casa Quest — API: Mission lifecycle
// PATCH /api/missions/[id]   { action: 'activate' | 'complete' | 'cancel' }
// ============================================================

import { NextResponse } from 'next/server';
import { requireMor, apiError } from '@/lib/require-mor';
import { settleMission, syncFamilyDay } from '@/lib/daily-actions';

const ACTIONS = ['activate', 'complete', 'cancel'] as const;
type Action = (typeof ACTIONS)[number];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMor();
  if (!auth.ok) return auth.response;
  const { db, mor } = auth.ctx;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  const action = body?.action as Action | undefined;
  if (!action || !ACTIONS.includes(action)) {
    return apiError('VALIDATION_ERROR', 'Ação inválida', 400);
  }

  const { data: mission } = await db
    .from('missions')
    .select('id, family_id, status, start_at, end_at, target_reward_amount')
    .eq('id', id)
    .eq('family_id', mor.family_id)
    .maybeSingle();

  if (!mission) return apiError('NOT_FOUND', 'Missão não encontrada', 404);

  if (action === 'activate') {
    if (mission.status !== 'draft') {
      return apiError('INVALID_STATE', 'Só um rascunho pode ser iniciado', 422);
    }

    const { count: activeCount } = await db
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('family_id', mor.family_id)
      .eq('status', 'active');
    if ((activeCount ?? 0) > 0) {
      return apiError('ALREADY_ACTIVE', 'Já existe uma missão em andamento. Encerre-a antes de iniciar outra.', 422);
    }

    const { data: guardians } = await db
      .from('guardians')
      .select('id')
      .eq('family_id', mor.family_id)
      .eq('is_mor', false)
      .eq('is_active', true);
    if (!guardians?.length) {
      return apiError('NO_GUARDIANS', 'Cadastre pelo menos um guardião ativo antes de iniciar.', 422);
    }

    const { count: templateCount } = await db
      .from('action_templates')
      .select('*', { count: 'exact', head: true })
      .eq('family_id', mor.family_id)
      .eq('is_active', true)
      .in('category', ['habitos', 'cooperacao']);
    if (!templateCount) {
      return apiError('NO_ACTIONS', 'Cadastre pelo menos um hábito ou atividade de colaboração antes de iniciar.', 422);
    }

    // Per-guardian mission state (only guardians, never the Mor).
    const { data: existing } = await db
      .from('mission_guardians')
      .select('guardian_id')
      .eq('mission_id', mission.id);
    const have = new Set((existing ?? []).map((e) => e.guardian_id));
    const rows = guardians
      .filter((g) => !have.has(g.id))
      .map((g) => ({
        mission_id: mission.id,
        guardian_id: g.id,
        initial_energy: 100,
        current_energy: 100,
        target_reward: mission.target_reward_amount,
      }));
    if (rows.length > 0) {
      const { error } = await db.from('mission_guardians').insert(rows);
      if (error) return apiError('DB_ERROR', error.message, 500);
    }

    const { error } = await db
      .from('missions')
      .update({ status: 'active' })
      .eq('id', mission.id)
      .eq('status', 'draft');
    if (error) return apiError('DB_ERROR', error.message, 500);

    const summary = await syncFamilyDay(db, mor.family_id);
    return NextResponse.json({ data: { id: mission.id, status: 'active', sync: summary } });
  }

  if (action === 'complete') {
    if (mission.status !== 'active') {
      return apiError('INVALID_STATE', 'Só uma missão em andamento pode ser encerrada', 422);
    }
    await settleMission(db, mor.family_id, mission);
    return NextResponse.json({ data: { id: mission.id, status: 'completed' } });
  }

  // cancel
  if (mission.status === 'completed') {
    return apiError('INVALID_STATE', 'Uma missão concluída não pode ser cancelada', 422);
  }
  const { error } = await db.from('missions').update({ status: 'cancelled' }).eq('id', mission.id);
  if (error) return apiError('DB_ERROR', error.message, 500);
  return NextResponse.json({ data: { id: mission.id, status: 'cancelled' } });
}

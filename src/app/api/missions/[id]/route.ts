// ============================================================
// Casa Quest — API: Mission lifecycle & editing
// PATCH /api/missions/[id]
//   { action: 'activate', replaceActive?: boolean }
//   { action: 'complete' }
//   { action: 'cancel' }
//   { action: 'update', name?, targetRewardAmount?, startAt?, endAt?,
//     guardianTargets?: { guardianId, target }[] }
// ============================================================

import { NextResponse } from 'next/server';
import { requireMor, apiError } from '@/lib/require-mor';
import { settleMission, syncFamilyDay } from '@/lib/daily-actions';
import { isChild } from '@/lib/roles';

const ACTIONS = ['activate', 'complete', 'cancel', 'update'] as const;
type Action = (typeof ACTIONS)[number];

interface Body {
  action?: string;
  replaceActive?: boolean;
  name?: string;
  targetRewardAmount?: number;
  startAt?: string;
  endAt?: string;
  guardianTargets?: { guardianId: string; target: number | null }[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMor();
  if (!auth.ok) return auth.response;
  const { db, mor } = auth.ctx;

  const { id } = await params;
  const body = ((await request.json().catch(() => null)) ?? {}) as Body;
  const action = body.action as Action | undefined;
  if (!action || !ACTIONS.includes(action)) {
    return apiError('VALIDATION_ERROR', 'Ação inválida', 400);
  }

  const { data: mission } = await db
    .from('missions')
    .select('id, family_id, status, start_at, end_at, target_reward_amount, name')
    .eq('id', id)
    .eq('family_id', mor.family_id)
    .maybeSingle();

  if (!mission) return apiError('NOT_FOUND', 'Missão não encontrada', 404);

  // Active children — used by activate and update. Adults never join a mission.
  const { data: allGuardians } = await db
    .from('guardians')
    .select('*')
    .eq('family_id', mor.family_id)
    .eq('is_active', true);
  const guardianIds = new Set((allGuardians ?? []).filter(isChild).map((g) => g.id));

  // ── update ─────────────────────────────────────────────────
  if (action === 'update') {
    if (mission.status === 'completed' || mission.status === 'cancelled') {
      return apiError('INVALID_STATE', 'Uma missão encerrada não pode ser editada', 422);
    }

    const patch: Record<string, unknown> = {};

    if (typeof body.name === 'string') {
      const name = body.name.trim();
      if (!name || name.length > 200) return apiError('VALIDATION_ERROR', 'Nome inválido', 400);
      patch.name = name;
    }

    if (body.targetRewardAmount !== undefined) {
      const target = Number(body.targetRewardAmount);
      if (!Number.isFinite(target) || target < 0) {
        return apiError('VALIDATION_ERROR', 'Mesada-alvo inválida', 400);
      }
      patch.target_reward_amount = Math.round(target * 100) / 100;
    }

    if (body.startAt !== undefined || body.endAt !== undefined) {
      if (mission.status !== 'draft') {
        return apiError('INVALID_STATE', 'As datas só podem mudar enquanto a missão é rascunho', 422);
      }
      const startAt = body.startAt ?? mission.start_at;
      const endAt = body.endAt ?? mission.end_at;
      if (!DATE_RE.test(startAt) || !DATE_RE.test(endAt) || endAt <= startAt) {
        return apiError('VALIDATION_ERROR', 'Período inválido', 400);
      }
      patch.start_at = startAt;
      patch.end_at = endAt;
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await db.from('missions').update(patch).eq('id', mission.id);
      if (error) return apiError('DB_ERROR', error.message, 500);
    }

    // Per-guardian targets. A null target means "use the mission's value".
    if (Array.isArray(body.guardianTargets)) {
      const missionTarget = Number(patch.target_reward_amount ?? mission.target_reward_amount ?? 0);
      const rows = body.guardianTargets
        .filter((t) => guardianIds.has(t.guardianId))
        .map((t) => {
          const value = t.target == null || t.target === undefined ? missionTarget : Number(t.target);
          return {
            mission_id: mission.id,
            guardian_id: t.guardianId,
            target_reward: Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : missionTarget,
          };
        });

      if (rows.length > 0) {
        // Upsert keeps energy columns of rows that already exist (active mission).
        const { error } = await db
          .from('mission_guardians')
          .upsert(rows, { onConflict: 'mission_id,guardian_id', ignoreDuplicates: false });
        if (error) return apiError('DB_ERROR', error.message, 500);
      }
    } else if (patch.target_reward_amount !== undefined) {
      // Mission target changed without explicit per-guardian values: rows that
      // still followed the old mission value follow the new one.
      await db
        .from('mission_guardians')
        .update({ target_reward: patch.target_reward_amount })
        .eq('mission_id', mission.id)
        .eq('target_reward', mission.target_reward_amount);
    }

    return NextResponse.json({ data: { id: mission.id, updated: true } });
  }

  // ── activate ───────────────────────────────────────────────
  if (action === 'activate') {
    if (mission.status !== 'draft') {
      return apiError('INVALID_STATE', 'Só um rascunho pode ser iniciado', 422);
    }

    const { data: actives } = await db
      .from('missions')
      .select('id, name, start_at, end_at, target_reward_amount, status')
      .eq('family_id', mor.family_id)
      .eq('status', 'active');

    if ((actives ?? []).length > 0) {
      if (!body.replaceActive) {
        return NextResponse.json(
          {
            error: {
              code: 'ALREADY_ACTIVE',
              message: `Já existe uma missão em andamento: "${actives![0]!.name}". Encerre-a para iniciar esta.`,
              activeMission: { id: actives![0]!.id, name: actives![0]!.name },
            },
          },
          { status: 409 }
        );
      }
      // Close the current one (energy final + reward) before starting the new.
      for (const active of actives ?? []) {
        await settleMission(db, mor.family_id, active);
      }
    }

    if (guardianIds.size === 0) {
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

    // Per-guardian mission state (only guardians, never the Mor). Rows created
    // while editing the draft (custom targets) are kept.
    const { data: existing } = await db
      .from('mission_guardians')
      .select('guardian_id')
      .eq('mission_id', mission.id);
    const have = new Set((existing ?? []).map((e) => e.guardian_id));
    const rows = Array.from(guardianIds)
      .filter((gid) => !have.has(gid))
      .map((gid) => ({
        mission_id: mission.id,
        guardian_id: gid,
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
    return NextResponse.json({
      data: { id: mission.id, status: 'active', sync: summary, replaced: (actives ?? []).length },
    });
  }

  // ── complete ───────────────────────────────────────────────
  if (action === 'complete') {
    if (mission.status !== 'active') {
      return apiError('INVALID_STATE', 'Só uma missão em andamento pode ser encerrada', 422);
    }
    await settleMission(db, mor.family_id, mission);
    return NextResponse.json({ data: { id: mission.id, status: 'completed' } });
  }

  // ── cancel ─────────────────────────────────────────────────
  if (mission.status === 'completed') {
    return apiError('INVALID_STATE', 'Uma missão concluída não pode ser cancelada', 422);
  }
  const { error } = await db.from('missions').update({ status: 'cancelled' }).eq('id', mission.id);
  if (error) return apiError('DB_ERROR', error.message, 500);
  return NextResponse.json({ data: { id: mission.id, status: 'cancelled' } });
}

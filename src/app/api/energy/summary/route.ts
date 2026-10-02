// ============================================================
// Casa Quest — API: Energy summary for the Mor's family
// GET /api/energy/summary
//
// Energia, constância, contagens e prévia da mesada de cada guardião
// na missão em andamento (ou na última encerrada).
// ============================================================

import { NextResponse } from 'next/server';
import { requireAdult, apiError } from '@/lib/require-mor';
import { isChild } from '@/lib/roles';
import { getGuardianEnergy } from '@/lib/guardian-energy';
import { calculateReward } from '@/domain/reward/calculator';
import { getEnergyPercentage } from '@/domain/energy/engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdult();
  if (!auth.ok) return auth.response;
  const { db, me, canSeeMoney } = auth.ctx;

  const { data: mission } = await db
    .from('missions')
    .select('id, name, start_at, end_at, status, target_reward_amount')
    .eq('family_id', me.family_id)
    .in('status', ['active', 'completed'])
    .order('status', { ascending: true }) // 'active' < 'completed'
    .order('start_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!mission) {
    return NextResponse.json({ data: { mission: null, guardians: [], canSeeMoney } });
  }

  const { data: allGuardians } = await db
    .from('guardians')
    .select('*')
    .eq('family_id', me.family_id)
    .order('name');
  const guardians = (allGuardians ?? []).filter(isChild);

  const { data: mgRows } = await db
    .from('mission_guardians')
    .select('guardian_id, target_reward, final_energy, final_reward, cooperation_score')
    .eq('mission_id', mission.id);
  const mgByGuardian = new Map((mgRows ?? []).map((r) => [r.guardian_id, r]));

  const results = [];
  for (const g of guardians ?? []) {
    const mg = mgByGuardian.get(g.id);
    if (!mg) continue; // not part of this mission

    try {
      const energy = await getGuardianEnergy(
        db,
        g.id,
        mission.id,
        me.family_id,
        new Date(`${mission.start_at}T12:00:00Z`)
      );
      const target = Number(mg.target_reward ?? mission.target_reward_amount ?? 0);
      const reward = calculateReward(
        energy.finalEnergy,
        energy.initialEnergy,
        target,
        mg.cooperation_score ?? 0
      );

      results.push({
        guardian: { id: g.id, name: g.name, age: g.age, isActive: g.is_active },
        energy,
        // Mesada é assunto de quem gerencia; conselheiros veem só se a família permitir.
        reward: canSeeMoney
          ? {
              target,
              tierPercent: reward.rewardPercent,
              base: reward.baseReward,
              cooperationBonus: reward.cooperationBonus,
              total: reward.totalReward,
              finalRecorded: mg.final_reward,
            }
          : null,
      });
    } catch (e) {
      return apiError('INTERNAL', e instanceof Error ? e.message : 'Erro ao calcular energia', 500);
    }
  }

  // O período anterior: a última missão encerrada antes desta. Fica na tela
  // para quem recebeu a mesada entender de onde veio o valor — os números
  // gravados no fechamento são os que valeram, o descritivo (feitas, faltas…)
  // é recontado até o último dia daquele período.
  const { data: prevMission } = await db
    .from('missions')
    .select('id, name, start_at, end_at, target_reward_amount')
    .eq('family_id', me.family_id)
    .eq('status', 'completed')
    .neq('id', mission.id)
    .lt('start_at', mission.start_at)
    .order('start_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let previous: unknown = null;
  if (prevMission) {
    const { data: prevRows } = await db
      .from('mission_guardians')
      .select('guardian_id, initial_energy, final_energy, final_reward, target_reward')
      .eq('mission_id', prevMission.id);
    const prevByGuardian = new Map((prevRows ?? []).map((r) => [r.guardian_id, r]));

    const prevGuardians = [];
    for (const g of guardians) {
      const row = prevByGuardian.get(g.id);
      if (!row || row.final_energy == null) continue;
      const initial = Number(row.initial_energy) || 100;
      let details = null;
      try {
        details = await getGuardianEnergy(
          db,
          g.id,
          prevMission.id,
          me.family_id,
          new Date(`${prevMission.start_at}T12:00:00Z`),
          new Date(`${prevMission.end_at}T12:00:00Z`)
        );
      } catch {
        // Sem o descritivo o cartão ainda mostra energia e mesada gravadas.
      }
      prevGuardians.push({
        guardian: { id: g.id, name: g.name },
        percentage: getEnergyPercentage(Number(row.final_energy), initial),
        qualitative: details?.qualitative ?? null,
        counts: details?.counts ?? null,
        completionRate: details?.completionRate ?? null,
        reward: canSeeMoney
          ? {
              target: Number(row.target_reward ?? prevMission.target_reward_amount ?? 0),
              final: row.final_reward == null ? null : Number(row.final_reward),
            }
          : null,
      });
    }
    previous = { mission: prevMission, guardians: prevGuardians };
  }

  return NextResponse.json({ data: { mission, guardians: results, previous, canSeeMoney } });
}

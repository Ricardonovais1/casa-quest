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
              tierPercent: reward.tier.rewardPercent,
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

  return NextResponse.json({ data: { mission, guardians: results, canSeeMoney } });
}

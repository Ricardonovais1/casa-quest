// ============================================================
// Casa Quest — API: retrato da família
// GET /api/families/overview
//
// Tudo que a tela de Família precisa mostrar de cada guardião, numa
// requisição só: o que ele tem hoje, o que caiu para ele na rodada da
// distribuição e como está a energia dele na missão.
//
// Existe para a página não ter que orquestrar quatro consultas no
// navegador (e para a energia, que é cálculo de servidor, não vazar
// para o cliente pela metade).
// ============================================================

import { NextResponse } from 'next/server';
import { requireAdult, apiError } from '@/lib/require-mor';
import { isChild } from '@/lib/roles';
import { getGuardianEnergy, type GuardianEnergy } from '@/lib/guardian-energy';
import type { OverviewAction, OverviewGuardian } from '@/lib/family-overview';
import { ensureCurrentDistribution } from '@/lib/distribution';
import { syncFamilyDay } from '@/lib/daily-actions';
import { localDayRangeUtc, localTimeString } from '@/lib/day-range';
import { categoryMeta } from '@/lib/default-actions';
import { ALL_EXTRA_CATEGORIES } from '@/lib/extra-events';

export const dynamic = 'force-dynamic';

interface TemplateRel {
  name: string;
  category: string;
  default_due_time: string | null;
}

function flatten(rel: unknown): TemplateRel {
  const t = (Array.isArray(rel) ? rel[0] : rel) as TemplateRel | null | undefined;
  return {
    name: t?.name ?? 'Ação',
    category: t?.category ?? 'habitos',
    default_due_time: t?.default_due_time ?? null,
  };
}

export async function GET() {
  const auth = await requireAdult();
  if (!auth.ok) return auth.response;
  const { db, me } = auth.ctx;

  // Abrir a Família também faz o dia existir, como o painel Hoje.
  await syncFamilyDay(db, me.family_id).catch(() => null);

  const { data: family } = await db
    .from('families')
    .select('*')
    .eq('id', me.family_id)
    .maybeSingle();
  if (!family) return apiError('NOT_FOUND', 'Família não encontrada', 404);

  const tz = family.timezone || 'America/Sao_Paulo';
  const { startUtc, endUtc } = localDayRangeUtc(tz);

  const [{ data: members }, { data: mission }, { assignments }] = await Promise.all([
    db.from('guardians').select('*').eq('family_id', me.family_id).order('name'),
    db
      .from('missions')
      .select('id, name, start_at, end_at, status')
      .eq('family_id', me.family_id)
      .eq('status', 'active')
      .order('start_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    ensureCurrentDistribution(db, me.family_id),
  ]);

  const kids = (members ?? []).filter(isChild);

  const { data: todayRows } = mission
    ? await db
        .from('mission_actions')
        .select(
          'id, guardian_id, status, due_at, action_templates(name, category, default_due_time)'
        )
        .eq('mission_id', mission.id)
        .gte('due_at', startUtc)
        .lt('due_at', endUtc)
        .order('due_at', { ascending: true })
    : { data: [] };

  const missionStart = mission ? new Date(`${mission.start_at}T12:00:00Z`) : null;

  const guardians: OverviewGuardian[] = [];
  for (const kid of kids) {
    const mine = (todayRows ?? []).filter((r) => r.guardian_id === kid.id);

    const actions: OverviewAction[] = mine.map((r) => {
      const template = flatten(r.action_templates);
      const meta = categoryMeta(template.category);
      const isExtra = ALL_EXTRA_CATEGORIES.includes(template.category);
      return {
        id: r.id,
        name: template.name,
        status: String(r.status),
        categoryEmoji: meta?.emoji ?? '📋',
        categoryLabel: meta?.label ?? template.category,
        whenLabel: isExtra
          ? `registrada ${localTimeString(tz, r.due_at)}`
          : template.default_due_time
            ? `até ${localTimeString(tz, r.due_at)}`
            : 'dia todo',
        isExtra,
      };
    });

    let energy: GuardianEnergy | null = null;
    if (mission && missionStart) {
      energy = await getGuardianEnergy(db, kid.id, mission.id, me.family_id, missionStart).catch(
        () => null
      );
    }

    guardians.push({
      id: kid.id,
      name: kid.name,
      age: kid.age ?? null,
      isActive: !!kid.is_active,
      accessToken: kid.access_token ?? null,
      today: {
        done: actions.filter((a) => a.status === 'confirmed').length,
        pending: actions.filter((a) => a.status === 'pending').length,
        awaiting: actions.filter((a) => a.status === 'marked_done').length,
        missed: actions.filter((a) => a.status === 'missed').length,
        actions,
      },
      assignments: assignments
        .filter((a) => a.guardian_id === kid.id)
        .map((a) => ({
          id: a.id,
          name: a.action_name,
          points: a.points,
          frequency: a.frequency,
        })),
      energy,
    });
  }

  return NextResponse.json({
    data: {
      mission: mission ? { id: mission.id, name: mission.name } : null,
      periodUntil: assignments[0]?.valid_until ?? null,
      guardians,
    },
  });
}

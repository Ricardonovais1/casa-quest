// ============================================================
// Casa Quest — API: resumo do dia anterior
// GET /api/daily-summary
//
// O que a casa fez ontem, para o pop-up da primeira abertura do dia:
// o que cada guardião cumpriu, o que ficou pelo caminho, as missões
// extras que entraram e como está a energia agora.
//
// Sempre o dia anterior no fuso da família — o "ontem" de quem abre o
// app às 6h da manhã em São Paulo, não o de UTC.
// ============================================================

import { NextResponse } from 'next/server';
import { requireAdult, apiError } from '@/lib/require-mor';
import { isChild } from '@/lib/roles';
import { getGuardianEnergy } from '@/lib/guardian-energy';
import { localDayRangeUtc, addDays, localDateString } from '@/lib/day-range';
import { EXTRA_EVENT_CATEGORIES, effectOfCategory } from '@/lib/extra-events';
import type { DailySummary, DailySummaryGuardian } from '@/lib/daily-summary';

export const dynamic = 'force-dynamic';

interface TemplateRel {
  name: string;
  category: string;
  points: number | null;
}

function flatten(rel: unknown): TemplateRel {
  const t = (Array.isArray(rel) ? rel[0] : rel) as TemplateRel | null | undefined;
  return { name: t?.name ?? 'Ação', category: t?.category ?? 'habitos', points: t?.points ?? 0 };
}

export async function GET() {
  const auth = await requireAdult();
  if (!auth.ok) return auth.response;
  const { db, me } = auth.ctx;

  const { data: family } = await db
    .from('families')
    .select('id, name, timezone')
    .eq('id', me.family_id)
    .maybeSingle();
  if (!family) return apiError('NOT_FOUND', 'Família não encontrada', 404);

  const tz = family.timezone || 'America/Sao_Paulo';
  const now = new Date();
  const yesterday = addDays(localDateString(tz, now), -1);
  const { startUtc, endUtc } = localDayRangeUtc(tz, new Date(now.getTime() - 86_400_000));

  const [{ data: members }, { data: mission }] = await Promise.all([
    db.from('guardians').select('*').eq('family_id', me.family_id).eq('is_active', true).order('name'),
    db
      .from('missions')
      .select('id, name, start_at, status')
      .eq('family_id', me.family_id)
      .in('status', ['active', 'completed'])
      .order('status', { ascending: true }) // 'active' < 'completed'
      .order('start_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const kids = (members ?? []).filter(isChild);

  // As ações de ontem, independentemente da missão a que pertencem: uma
  // missão pode ter sido encerrada de madrugada e o dia ainda conta.
  const { data: rows } = await db
    .from('mission_actions')
    .select(
      'id, guardian_id, status, missions!inner(family_id), action_templates(name, category, points)'
    )
    .eq('missions.family_id', me.family_id)
    .gte('due_at', startUtc)
    .lt('due_at', endUtc);

  const guardians: DailySummaryGuardian[] = [];
  const achievements: string[] = [];

  for (const kid of kids) {
    const mine = (rows ?? []).filter((r) => r.guardian_id === kid.id);

    let done = 0;
    let missed = 0;
    let points = 0;
    const extras: string[] = [];

    for (const row of mine) {
      const template = flatten(row.action_templates);
      const isExtra = EXTRA_EVENT_CATEGORIES.includes(template.category);
      const isTropeco = effectOfCategory(template.category) === 'tropeco';

      if (row.status === 'confirmed') {
        done++;
        points += template.points ?? 0;
        if (isExtra) extras.push(template.name);
      } else if (row.status === 'missed') {
        missed++;
        // Tropeço já nasce com pontuação negativa; falta de tarefa não tira ponto.
        if (isTropeco) points += template.points ?? 0;
      }
    }

    const scheduled = mine.filter((r) => r.status !== 'cancelled').length;
    const allDone = scheduled > 0 && missed === 0 && done === scheduled;

    let energyPercent: number | null = null;
    if (mission) {
      const energy = await getGuardianEnergy(
        db,
        kid.id,
        mission.id,
        me.family_id,
        new Date(`${mission.start_at}T12:00:00Z`),
        now
      ).catch(() => null);
      energyPercent = energy?.percentage ?? null;
    }

    const firstName = kid.name.split(' ')[0] ?? kid.name;
    if (allDone) achievements.push(`${firstName} fechou o dia com tudo feito 🎉`);
    if (extras.length > 0) {
      const what = extras.length === 1 ? 'uma missão extra' : `${extras.length} missões extras`;
      achievements.push(`${firstName} registrou ${what}: ${extras.join(', ')} 🏆`);
    }

    guardians.push({
      id: kid.id,
      name: kid.name,
      done,
      missed,
      scheduled,
      points,
      extras,
      allDone,
      energyPercent,
    });
  }

  const totals = guardians.reduce(
    (acc, g) => ({
      done: acc.done + g.done,
      missed: acc.missed + g.missed,
      extras: acc.extras + g.extras.length,
    }),
    { done: 0, missed: 0, extras: 0 }
  );

  const summary: DailySummary = {
    date: yesterday,
    familyName: family.name,
    mission: mission ? { id: mission.id, name: mission.name } : null,
    totals,
    guardians,
    achievements,
    // Um dia sem nenhum registro não merece um pop-up.
    hasActivity: totals.done + totals.missed > 0,
  };

  return NextResponse.json({ data: summary });
}

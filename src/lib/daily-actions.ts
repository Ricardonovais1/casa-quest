// ============================================================
// Casa Quest — Lib: Daily actions (generate · sweep · settle)
//
// O ciclo do dia de uma família:
//   1. gerar as ações de hoje para cada guardião (hábitos para todos,
//      colaboração para quem está com a atividade na distribuição);
//   2. transformar em falta o que passou do prazo + tolerância;
//   3. encerrar a missão quando o período acaba, gravando energia
//      final e mesada sugerida.
//
// Idempotente: pode rodar quantas vezes for (abertura do app, cron).
// Precisa de um client com permissão de escrita na família (service
// role, depois de autorizar o chamador) — ou de RLS que permita.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  localDateString,
  localDayRangeUtc,
  localDateTimeToUtc,
  weekdayInTz,
  dayEndOf,
  dueTimeOf,
} from './day-range';
import { isScheduledOn } from './scheduling';
import { isChild, type RoleSubject } from './roles';
import { ensureCurrentDistribution } from './distribution';
import { getGuardianEnergy } from './guardian-energy';
import { calculateReward } from '@/domain/reward/calculator';

export interface SyncSummary {
  familyId: string;
  date: string;
  missionId: string | null;
  missionStatus: 'none' | 'not_started' | 'active' | 'settled';
  generated: number;
  /** Ações do dia que mudaram de dono (ou sumiram) porque a distribuição mudou. */
  realigned: number;
  missed: number;
}

interface FamilyRow {
  id: string;
  timezone: string | null;
  tolerance_minutes: number | null;
  /** Migração 00009. Hora em que o dia fecha; 22:00 antes dela. */
  day_end_time?: string | null;
}

interface MissionRow {
  id: string;
  start_at: string;
  end_at: string;
  target_reward_amount: number;
  status: string;
}

/** Categories that turn into concrete daily actions. */
const DAILY_CATEGORIES = ['habitos', 'cooperacao'] as const;

export interface DayActionRow {
  id: string;
  guardian_id: string;
  action_template_id: string;
  due_at: string;
  status: string;
}

export interface PlannedAction {
  guardian_id: string;
  action_template_id: string;
  due_at: string;
}

export interface RealignmentPlan {
  /** Ações pendentes que mudam de dono, de horário, ou os dois. */
  move: { id: string; guardianId: string; dueAt: string }[];
  /** Ações pendentes que somem: não fazem mais parte do dia. */
  drop: string[];
}

/**
 * O combinado pode mudar depois que o dia já foi gerado: o Mor troca a
 * distribuição, marca uma hora numa ação, muda o fim do dia. O que já está
 * no dia precisa acompanhar:
 *
 *   • só mexe no que ainda está pendente — o que já foi feito, marcado ou
 *     virou falta é história de quem estava com a ação;
 *   • só mexe no que o dia gera (hábitos e colaboração); tropeços, missões
 *     extras e escaladas são registros do Mor e ficam como estão;
 *   • atividade de colaboração segue quem está com ela agora; hábito segue
 *     com o mesmo guardião, só acerta a hora;
 *   • se o novo dono já tem aquela linha, a antiga sai em vez de virar
 *     duplicata (a mesma tarefa apareceria para os dois);
 *   • se a ação saiu do dia (ficou sem dono, mudou de frequência), a linha
 *     pendente sai junto.
 *
 * Pura: devolve o plano, quem chama aplica.
 */
export function planRealignment(
  rows: DayActionRow[],
  planned: PlannedAction[],
  dailyTemplateIds: Set<string>,
  sharedTemplateIds: Set<string>
): RealignmentPlan {
  const plan: RealignmentPlan = { move: [], drop: [] };
  // O banco devolve "…+00:00" e o dia planejado usa ISO "…Z": comparar
  // texto diria que todo horário mudou. O instante é o que importa.
  const slot = (guardianId: string, templateId: string, dueAt: string) =>
    `${guardianId}|${templateId}|${Date.parse(dueAt)}`;
  const sameInstant = (a: string, b: string) => Date.parse(a) === Date.parse(b);

  // Onde cada linha deveria estar hoje.
  const bySharedTemplate = new Map<string, PlannedAction>();
  const byGuardianTemplate = new Map<string, PlannedAction>();
  for (const p of planned) {
    if (sharedTemplateIds.has(p.action_template_id)) {
      bySharedTemplate.set(p.action_template_id, p);
    }
    byGuardianTemplate.set(`${p.guardian_id}|${p.action_template_id}`, p);
  }

  // Quem já ocupa cada (guardião, ação, horário) hoje — incluindo o que já
  // foi feito ou virou falta, que continua ocupando o lugar.
  const taken = new Set(rows.map((r) => slot(r.guardian_id, r.action_template_id, r.due_at)));

  for (const row of rows) {
    if (row.status !== 'pending') continue;
    if (!dailyTemplateIds.has(row.action_template_id)) continue;

    const target = sharedTemplateIds.has(row.action_template_id)
      ? bySharedTemplate.get(row.action_template_id)
      : byGuardianTemplate.get(`${row.guardian_id}|${row.action_template_id}`);

    if (!target) {
      plan.drop.push(row.id);
      continue;
    }

    if (target.guardian_id === row.guardian_id && sameInstant(target.due_at, row.due_at)) continue;

    const to = slot(target.guardian_id, row.action_template_id, target.due_at);
    if (taken.has(to)) {
      plan.drop.push(row.id);
      continue;
    }

    taken.delete(slot(row.guardian_id, row.action_template_id, row.due_at));
    taken.add(to);
    plan.move.push({ id: row.id, guardianId: target.guardian_id, dueAt: target.due_at });
  }

  return plan;
}

/** Aplica o plano. Devolve quantas linhas mudaram. */
async function applyRealignment(
  supabase: SupabaseClient,
  plan: RealignmentPlan
): Promise<number> {
  let changed = 0;

  for (const m of plan.move) {
    const { error } = await supabase
      .from('mission_actions')
      .update({ guardian_id: m.guardianId, due_at: m.dueAt })
      .eq('id', m.id)
      // Se o guardião marcou "Fiz!" no meio da troca, a ação é dele.
      .eq('status', 'pending');
    if (!error) changed++;
  }

  if (plan.drop.length > 0) {
    const { error } = await supabase
      .from('mission_actions')
      .delete()
      .in('id', plan.drop)
      .eq('status', 'pending');
    if (!error) changed += plan.drop.length;
  }

  return changed;
}

/**
 * Generate today's `mission_actions` for every active guardian, and keep the
 * day in sync with the current distribution.
 * Returns how many rows were inserted and how many changed hands.
 */
export async function ensureDailyActions(
  supabase: SupabaseClient,
  family: FamilyRow,
  mission: MissionRow,
  now: Date = new Date()
): Promise<{ generated: number; realigned: number }> {
  const tz = family.timezone || 'America/Sao_Paulo';
  const dayEnd = dayEndOf(family);
  const { date, startUtc, endUtc } = localDayRangeUtc(tz, now);
  const weekday = weekdayInTz(tz, now);

  const [{ data: allGuardians }, { data: templates }, { assignments }] = await Promise.all([
    // select('*') + isChild(): adults (Mor, Conselheiros) never get daily actions,
    // and this keeps working before migration 00008 adds the role column.
    supabase
      .from('guardians')
      .select('*')
      .eq('family_id', family.id)
      .eq('is_active', true),
    supabase
      .from('action_templates')
      .select('id, category, frequency, default_due_time')
      .eq('family_id', family.id)
      .eq('is_active', true)
      .in('category', [...DAILY_CATEGORIES]),
    ensureCurrentDistribution(supabase, family.id),
  ]);

  const guardians = (allGuardians ?? []).filter(isChild);
  if (!guardians.length || !templates?.length) return { generated: 0, realigned: 0 };

  const assignedTo = new Map<string, string>();
  for (const a of assignments) assignedTo.set(a.action_template_id, a.guardian_id);

  // What should exist today
  const planned: PlannedAction[] = [];
  for (const t of templates) {
    if (!isScheduledOn(t.frequency, weekday)) continue;
    // Sem hora marcada, a ação vale o dia todo e fecha no fim do dia.
    const dueAt = localDateTimeToUtc(tz, date, dueTimeOf(t, dayEnd));

    if (t.category === 'cooperacao') {
      const gid = assignedTo.get(t.id);
      if (gid && guardians.some((g) => g.id === gid)) {
        planned.push({ guardian_id: gid, action_template_id: t.id, due_at: dueAt });
      }
      continue;
    }

    for (const g of guardians) {
      planned.push({ guardian_id: g.id, action_template_id: t.id, due_at: dueAt });
    }
  }

  // What already exists today
  const { data: existing } = await supabase
    .from('mission_actions')
    .select('id, guardian_id, action_template_id, due_at, status')
    .eq('mission_id', mission.id)
    .gte('due_at', startUtc)
    .lt('due_at', endUtc);

  // O combinado pode ter mudado depois que o dia foi gerado (distribuição,
  // hora marcada, fim do dia): o que ainda está pendente se acerta antes de
  // qualquer coisa, senão a tarefa apareceria duplicada ou no horário velho.
  const rows = (existing ?? []) as DayActionRow[];
  const plan = planRealignment(
    rows,
    planned,
    new Set(templates.map((t) => t.id)),
    new Set(templates.filter((t) => t.category === 'cooperacao').map((t) => t.id))
  );
  const realigned = await applyRealignment(supabase, plan);

  if (planned.length === 0) return { generated: 0, realigned };

  const dropped = new Set(plan.drop);
  const moved = new Map(plan.move.map((m) => [m.id, m.guardianId]));
  const have = new Set(
    rows
      .filter((e) => !dropped.has(e.id))
      .map((e) => `${moved.get(e.id) ?? e.guardian_id}|${e.action_template_id}`)
  );
  const missing = planned.filter((p) => !have.has(`${p.guardian_id}|${p.action_template_id}`));

  if (missing.length === 0) return { generated: 0, realigned };

  const { error } = await supabase.from('mission_actions').insert(
    missing.map((m) => ({
      mission_id: mission.id,
      guardian_id: m.guardian_id,
      action_template_id: m.action_template_id,
      due_at: m.due_at,
      status: 'pending',
      confirmation_status: 'pending',
    }))
  );

  // 23505 = unique violation: another request generated the same day at the
  // same time. The rows exist, which is all we wanted.
  if (error && error.code !== '23505') {
    throw new Error(`Falha ao gerar ações do dia: ${error.message}`);
  }

  return { generated: error ? 0 : missing.length, realigned };
}

/** Minimum window a guardian gets when an action was generated late. */
const LATE_GENERATION_GRACE_MINUTES = 60;

/**
 * The instant after which a pending action counts as missed.
 * Normally due + tolerance. If the action was generated late (nobody opened
 * the app and the cron had not run yet), the guardian still gets at least
 * an hour from generation — they never had a chance before that.
 *
 * Quem chama passa `toleranceMinutes` 0 para as ações sem hora marcada: o
 * fim do dia já é o limite, não se soma tolerância em cima dele.
 */
export function missDeadline(
  dueAt: string,
  createdAt: string,
  toleranceMinutes: number
): number {
  const tol = Math.max(0, toleranceMinutes) * 60_000;
  const grace = Math.max(toleranceMinutes, LATE_GENERATION_GRACE_MINUTES) * 60_000;
  return Math.max(Date.parse(dueAt) + tol, Date.parse(createdAt) + grace);
}

/**
 * Turn overdue pending actions into misses. Returns how many changed.
 *
 * `grace` isenta o primeiro dia da missão: as ações desse dia nascem quando a
 * missão é criada, muitas vezes com o dia já adiantado, e ninguém falta com o
 * que ainda não sabia que existia. Sem isso, a missão começava com uma
 * enxurrada de faltas — numa família real foram 17 faltas no dia 1.
 */
export async function sweepOverdueActions(
  supabase: SupabaseClient,
  missionId: string,
  toleranceMinutes: number,
  now: Date = new Date(),
  grace: { missionStart?: string; timeZone?: string } = {}
): Promise<number> {
  const { data: pending } = await supabase
    .from('mission_actions')
    .select('id, due_at, created_at, action_templates(default_due_time)')
    .eq('mission_id', missionId)
    .eq('status', 'pending')
    .lt('due_at', now.toISOString());

  const tz = grace.timeZone || 'America/Sao_Paulo';
  const firstDay = grace.missionStart ?? null;

  const overdue = (pending ?? []).filter((a) => {
    // Dia 1 da missão nunca vira falta.
    if (firstDay && localDateString(tz, new Date(a.due_at)) === firstDay) return false;
    const rel = a.action_templates as
      | { default_due_time: string | null }
      | { default_due_time: string | null }[]
      | null;
    const template = Array.isArray(rel) ? rel[0] : rel;
    // Hora marcada ganha a tolerância da casa; sem hora, o fim do dia é o fim.
    const tolerance = template?.default_due_time ? toleranceMinutes : 0;
    return now.getTime() > missDeadline(a.due_at, a.created_at ?? a.due_at, tolerance);
  });

  if (overdue.length === 0) return 0;

  // missed_at = due_at so absence sequences line up with the day the task
  // belonged to, not with whenever the sweep happened to run.
  let changed = 0;
  for (const a of overdue) {
    const { error } = await supabase
      .from('mission_actions')
      .update({ status: 'missed', missed_at: a.due_at, confirmation_status: 'not_required' })
      .eq('id', a.id)
      .eq('status', 'pending');
    if (!error) changed++;
  }
  return changed;
}

/**
 * Close a mission whose period is over: compute each guardian's final
 * energy and suggested reward, then mark the mission completed.
 */
export async function settleMission(
  supabase: SupabaseClient,
  familyId: string,
  mission: MissionRow
): Promise<void> {
  const { data: rows } = await supabase
    .from('mission_guardians')
    .select('id, guardian_id, initial_energy, target_reward, cooperation_score, guardians!inner(is_mor, role)')
    .eq('mission_id', mission.id);

  for (const row of rows ?? []) {
    // Mesada é só das crianças. Filtrar por `is_mor` deixava passar o
    // Conselheiro (is_mor = false), que ganharia energia e mesada calculadas.
    const rel = row.guardians as RoleSubject | RoleSubject[] | null;
    const who = Array.isArray(rel) ? rel[0] : rel;
    if (!isChild(who)) continue;

    const energy = await getGuardianEnergy(
      supabase,
      row.guardian_id,
      mission.id,
      familyId,
      new Date(`${mission.start_at}T12:00:00Z`)
    );
    const reward = calculateReward(
      energy.finalEnergy,
      energy.initialEnergy,
      Number(row.target_reward ?? mission.target_reward_amount ?? 0),
      row.cooperation_score ?? 0
    );

    await supabase
      .from('mission_guardians')
      .update({
        final_energy: energy.finalEnergy,
        current_energy: energy.finalEnergy,
        final_reward: reward.totalReward,
      })
      .eq('id', row.id);
  }

  await supabase
    .from('missions')
    .update({ status: 'completed' })
    .eq('id', mission.id)
    .eq('status', 'active');
}

/**
 * Run the whole daily cycle for one family. Safe to call on every page
 * load: it only writes what is missing.
 */
export async function syncFamilyDay(
  supabase: SupabaseClient,
  familyId: string,
  now: Date = new Date()
): Promise<SyncSummary> {
  // select('*') para seguir funcionando antes da migração 00009 (day_end_time).
  const { data: family } = await supabase
    .from('families')
    .select('*')
    .eq('id', familyId)
    .maybeSingle();

  const tz = family?.timezone || 'America/Sao_Paulo';
  const date = localDateString(tz, now);
  const base: SyncSummary = {
    familyId,
    date,
    missionId: null,
    missionStatus: 'none',
    generated: 0,
    realigned: 0,
    missed: 0,
  };

  if (!family) return base;

  const { data: mission } = await supabase
    .from('missions')
    .select('id, start_at, end_at, target_reward_amount, status')
    .eq('family_id', familyId)
    .eq('status', 'active')
    .order('start_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!mission) return base;
  base.missionId = mission.id;

  // Period over → final sweep, then settle.
  if (mission.end_at < date) {
    base.missed = await sweepOverdueActions(
      supabase,
      mission.id,
      family.tolerance_minutes ?? 30,
      now,
      { missionStart: mission.start_at, timeZone: tz }
    );
    await settleMission(supabase, familyId, mission);
    base.missionStatus = 'settled';
    return base;
  }

  if (mission.start_at > date) {
    base.missionStatus = 'not_started';
    return base;
  }

  base.missionStatus = 'active';
  const day = await ensureDailyActions(supabase, family, mission, now);
  base.generated = day.generated;
  base.realigned = day.realigned;
  base.missed = await sweepOverdueActions(
    supabase,
    mission.id,
    family.tolerance_minutes ?? 30,
    now,
    { missionStart: mission.start_at, timeZone: tz }
  );
  return base;
}

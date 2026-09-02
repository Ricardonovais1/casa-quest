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
} from './day-range';
import { isScheduledOn } from './scheduling';
import { ensureCurrentDistribution } from './distribution';
import { getGuardianEnergy } from './guardian-energy';
import { calculateReward } from '@/domain/reward/calculator';

export interface SyncSummary {
  familyId: string;
  date: string;
  missionId: string | null;
  missionStatus: 'none' | 'not_started' | 'active' | 'settled';
  generated: number;
  missed: number;
}

interface FamilyRow {
  id: string;
  timezone: string | null;
  tolerance_minutes: number | null;
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

/**
 * Generate today's `mission_actions` for every active guardian.
 * Returns how many rows were inserted (0 when the day is already complete).
 */
export async function ensureDailyActions(
  supabase: SupabaseClient,
  family: FamilyRow,
  mission: MissionRow,
  now: Date = new Date()
): Promise<number> {
  const tz = family.timezone || 'America/Sao_Paulo';
  const { date, startUtc, endUtc } = localDayRangeUtc(tz, now);
  const weekday = weekdayInTz(tz, now);

  const [{ data: guardians }, { data: templates }, { assignments }] = await Promise.all([
    supabase
      .from('guardians')
      .select('id')
      .eq('family_id', family.id)
      .eq('is_mor', false)
      .eq('is_active', true),
    supabase
      .from('action_templates')
      .select('id, category, frequency, default_due_time')
      .eq('family_id', family.id)
      .eq('is_active', true)
      .in('category', [...DAILY_CATEGORIES]),
    ensureCurrentDistribution(supabase, family.id),
  ]);

  if (!guardians?.length || !templates?.length) return 0;

  const assignedTo = new Map<string, string>();
  for (const a of assignments) assignedTo.set(a.action_template_id, a.guardian_id);

  // What should exist today
  const planned: { guardian_id: string; action_template_id: string; due_at: string }[] = [];
  for (const t of templates) {
    if (!isScheduledOn(t.frequency, weekday)) continue;
    const dueAt = localDateTimeToUtc(tz, date, String(t.default_due_time || '20:00'));

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

  if (planned.length === 0) return 0;

  // What already exists today
  const { data: existing } = await supabase
    .from('mission_actions')
    .select('guardian_id, action_template_id')
    .eq('mission_id', mission.id)
    .gte('due_at', startUtc)
    .lt('due_at', endUtc);

  const have = new Set((existing ?? []).map((e) => `${e.guardian_id}|${e.action_template_id}`));
  const missing = planned.filter((p) => !have.has(`${p.guardian_id}|${p.action_template_id}`));

  if (missing.length === 0) return 0;

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

  return error ? 0 : missing.length;
}

/** Minimum window a guardian gets when an action was generated late. */
const LATE_GENERATION_GRACE_MINUTES = 60;

/**
 * The instant after which a pending action counts as missed.
 * Normally due + tolerance. If the action was generated late (nobody opened
 * the app and the cron had not run yet), the guardian still gets at least
 * an hour from generation — they never had a chance before that.
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

/** Turn overdue pending actions into misses. Returns how many changed. */
export async function sweepOverdueActions(
  supabase: SupabaseClient,
  missionId: string,
  toleranceMinutes: number,
  now: Date = new Date()
): Promise<number> {
  const { data: pending } = await supabase
    .from('mission_actions')
    .select('id, due_at, created_at')
    .eq('mission_id', missionId)
    .eq('status', 'pending')
    .lt('due_at', now.toISOString());

  const overdue = (pending ?? []).filter(
    (a) => now.getTime() > missDeadline(a.due_at, a.created_at ?? a.due_at, toleranceMinutes)
  );

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
    .select('id, guardian_id, initial_energy, target_reward, cooperation_score, guardians!inner(is_mor)')
    .eq('mission_id', mission.id);

  for (const row of rows ?? []) {
    const rel = row.guardians as { is_mor: boolean } | { is_mor: boolean }[] | null;
    const isMor = Array.isArray(rel) ? rel[0]?.is_mor : rel?.is_mor;
    if (isMor) continue;

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
  const { data: family } = await supabase
    .from('families')
    .select('id, timezone, tolerance_minutes')
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
      now
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
  base.generated = await ensureDailyActions(supabase, family, mission, now);
  base.missed = await sweepOverdueActions(
    supabase,
    mission.id,
    family.tolerance_minutes ?? 30,
    now
  );
  return base;
}

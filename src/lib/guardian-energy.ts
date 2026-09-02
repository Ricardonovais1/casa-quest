// ============================================================
// Casa Quest — Lib: Energia do guardião (I/O + domínio)
//
// Reúne os dados da missão e delega o cálculo ao engine puro
// (src/domain/energy/engine.ts). Usado tanto pela rota da API
// quanto pela página do guardião, que é server component.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildSequences,
  computeEnergy,
  getQualitativeState,
  getEnergyPercentage,
} from '@/domain/energy/engine';
import type { AbsenceSequence, QualitativeStateInfo } from '@/domain/energy/types';
import { localDateString } from './day-range';

// DECISION: recurrence_weight não é coluna em `families`; fica constante
// aqui até que uma migração a introduza.
const RECURRENCE_WEIGHT = 0.5;

export interface GuardianEnergy {
  percentage: number;
  finalEnergy: number;
  initialEnergy: number;
  qualitative: QualitativeStateInfo;
  cooperationScore: number;
  /** Dias seguidos, até hoje, sem nenhuma ação perdida. */
  streakDays: number;
  /** Contagens da missão, para transparência. */
  counts: { done: number; missed: number; pending: number; recoveries: number; escaladaPoints: number };
}

/**
 * Consecutive days, counting back from today, with no missed action —
 * never reaching before `missionStart`, since nothing was expected then.
 * "Constância" só faz sentido como número derivado; antes era fixo na UI.
 */
export function computeStreakDays(
  missedDates: Date[],
  missionStart: Date,
  today: Date = new Date()
): number {
  const dayKey = (d: Date) => d.toISOString().split('T')[0]!;
  const missed = new Set(missedDates.map(dayKey));
  const startKey = dayKey(missionStart);

  let streak = 0;
  const cursor = new Date(today);

  // Walk back day by day, stopping at the first miss or at the mission start.
  while (streak < 365) {
    if (missed.has(dayKey(cursor))) break;
    streak++;
    if (dayKey(cursor) === startKey) break;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

/**
 * Anchor an instant to noon UTC of its calendar day in the family's
 * timezone. Day arithmetic in the engine (consecutive days, streaks) then
 * works on UTC dates without ever crossing a boundary by accident.
 */
function anchorToLocalDay(at: Date | string, timeZone: string): Date {
  const d = typeof at === 'string' ? new Date(at) : at;
  return new Date(`${localDateString(timeZone, d)}T12:00:00Z`);
}

/** Gather everything the energy engine needs and compute it. */
export async function getGuardianEnergy(
  supabase: SupabaseClient,
  guardianId: string,
  missionId: string,
  familyId: string,
  missionStart: Date,
  now: Date = new Date()
): Promise<GuardianEnergy> {
  const [
    { data: mg },
    { data: missedActions },
    { count: recoveryCount },
    { data: confirmedActions },
    { count: pendingCount },
    { data: familyConfig },
  ] = await Promise.all([
    supabase
      .from('mission_guardians')
      .select('initial_energy, cooperation_score')
      .eq('guardian_id', guardianId)
      .eq('mission_id', missionId)
      .maybeSingle(),
    supabase
      .from('mission_actions')
      .select('action_template_id, missed_at, due_at')
      .eq('guardian_id', guardianId)
      .eq('mission_id', missionId)
      .eq('status', 'missed')
      .order('missed_at', { ascending: true }),
    supabase
      .from('mission_actions')
      .select('*', { count: 'exact', head: true })
      .eq('guardian_id', guardianId)
      .eq('mission_id', missionId)
      .eq('status', 'confirmed')
      .not('recovers_action_id', 'is', null),
    supabase
      .from('mission_actions')
      .select('escalada_points_earned')
      .eq('guardian_id', guardianId)
      .eq('mission_id', missionId)
      .eq('status', 'confirmed'),
    supabase
      .from('mission_actions')
      .select('*', { count: 'exact', head: true })
      .eq('guardian_id', guardianId)
      .eq('mission_id', missionId)
      .in('status', ['pending', 'marked_done']),
    supabase
      .from('families')
      .select('recovery_value, timezone')
      .eq('id', familyId)
      .maybeSingle(),
  ]);

  const tz = familyConfig?.timezone || 'America/Sao_Paulo';
  const initialEnergy = Number(mg?.initial_energy) || 100;

  const escaladaPoints = (confirmedActions ?? []).reduce(
    (sum, a) => sum + (a.escalada_points_earned || 0),
    0
  );

  // Group absences by template — a sequence is per-action, not per-guardian —
  // and only consecutive days form one sequence (2ⁿ − 1 grows with streaks
  // of neglect, not with the total count).
  const byTemplate = new Map<string, Date[]>();
  const allMissedDates: Date[] = [];
  for (const action of missedActions ?? []) {
    const when = action.missed_at ?? action.due_at;
    if (!when) continue;
    const date = anchorToLocalDay(when, tz);
    allMissedDates.push(date);
    const key = action.action_template_id ?? 'sem-template';
    const dates = byTemplate.get(key) ?? [];
    dates.push(date);
    byTemplate.set(key, dates);
  }

  const sequences: AbsenceSequence[] = [];
  for (const [actionTemplateId, dates] of byTemplate) {
    // Two misses of the same template on the same day (e.g. a tropeço
    // recorded twice) are one absence for sequencing purposes.
    const unique = Array.from(new Map(dates.map((d) => [d.toISOString(), d])).values());
    sequences.push(...buildSequences(unique, guardianId, missionId, actionTemplateId));
  }

  const result = computeEnergy(sequences, recoveryCount || 0, escaladaPoints, {
    initialEnergy,
    recurrenceWeight: RECURRENCE_WEIGHT,
    recoveryValue: familyConfig?.recovery_value || 2,
  });

  return {
    percentage: getEnergyPercentage(result.finalEnergy, initialEnergy),
    finalEnergy: result.finalEnergy,
    initialEnergy,
    qualitative: getQualitativeState(result.finalEnergy, initialEnergy),
    cooperationScore: mg?.cooperation_score || 0,
    streakDays: computeStreakDays(
      allMissedDates,
      anchorToLocalDay(missionStart, tz),
      anchorToLocalDay(now, tz)
    ),
    counts: {
      done: confirmedActions?.length ?? 0,
      missed: missedActions?.length ?? 0,
      pending: pendingCount ?? 0,
      recoveries: recoveryCount ?? 0,
      escaladaPoints,
    },
  };
}

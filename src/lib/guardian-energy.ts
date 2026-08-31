// ============================================================
// Casa Quest — Lib: Energia do guardião (I/O + domínio)
//
// Reúne os dados da missão e delega o cálculo ao engine puro
// (src/domain/energy/engine.ts). Usado tanto pela rota da API
// quanto pela página do guardião, que é server component.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  computeEnergy,
  getQualitativeState,
  getEnergyPercentage,
} from '@/domain/energy/engine';
import type { AbsenceSequence, QualitativeStateInfo } from '@/domain/energy/types';

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

/** Gather everything the energy engine needs and compute it. */
export async function getGuardianEnergy(
  supabase: SupabaseClient,
  guardianId: string,
  missionId: string,
  familyId: string,
  missionStart: Date
): Promise<GuardianEnergy> {
  const [{ data: mg }, { data: missedActions }, { count: recoveryCount }, { data: escaladaActions }, { data: familyConfig }] =
    await Promise.all([
      supabase
        .from('mission_guardians')
        .select('initial_energy, cooperation_score')
        .eq('guardian_id', guardianId)
        .eq('mission_id', missionId)
        .maybeSingle(),
      supabase
        .from('mission_actions')
        .select('action_template_id, missed_at')
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
        .eq('status', 'confirmed')
        .not('escalada_points_earned', 'is', null),
      supabase.from('families').select('recovery_value').eq('id', familyId).maybeSingle(),
    ]);

  const initialEnergy = mg?.initial_energy || 100;

  const escaladaPoints = (escaladaActions ?? []).reduce(
    (sum, a) => sum + (a.escalada_points_earned || 0),
    0
  );

  // Group absences by template — a sequence is per-action, not per-guardian.
  const byTemplate = new Map<string, Date[]>();
  const allMissedDates: Date[] = [];
  for (const action of missedActions ?? []) {
    if (!action.missed_at) continue;
    const date = new Date(action.missed_at);
    allMissedDates.push(date);
    const dates = byTemplate.get(action.action_template_id) ?? [];
    dates.push(date);
    byTemplate.set(action.action_template_id, dates);
  }

  const sequences: AbsenceSequence[] = [];
  for (const [actionTemplateId, dates] of byTemplate) {
    sequences.push({
      guardianId,
      missionId,
      actionTemplateId,
      absenceDates: dates.sort((a, b) => a.getTime() - b.getTime()),
      length: dates.length,
    });
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
    streakDays: computeStreakDays(allMissedDates, missionStart),
  };
}

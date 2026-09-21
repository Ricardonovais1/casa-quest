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

/**
 * Janela móvel da energia, em dias (inclui hoje).
 *
 * DECISION (2026-09-11): a energia passa a olhar só os últimos dias, não a
 * missão inteira. Sem isso, a penalidade de reincidência — 2^k, com k = número
 * de sequências de falta — crescia para sempre: a 9ª falta isolada de uma
 * missão custava 129 pontos numa escala de 100, e não havia caminho de volta.
 * Falta velha sai da conta; mérito velho também, para a janela ser coerente.
 *
 * DECISION: como recurrence_weight, fica constante aqui até que uma migração
 * traga a coluna em `families`.
 */
export const ENERGY_WINDOW_DAYS = 30;

export interface GuardianEnergy {
  percentage: number;
  finalEnergy: number;
  initialEnergy: number;
  qualitative: QualitativeStateInfo;
  cooperationScore: number;
  /** Dias seguidos, até hoje, sem nenhuma ação perdida. */
  streakDays: number;
  /** Início da janela considerada (YYYY-MM-DD, dia local da casa). */
  windowStart: string;
  /** Tamanho da janela em dias. */
  windowDays: number;
  /** Contagens dentro da janela, para transparência. `pending` é da missão toda. */
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

/**
 * First day the energy still looks at: `windowDays` counting back from today
 * (today included), never before the mission started — nothing was expected
 * then. Returned as a noon-UTC anchor, like every other date in here.
 */
export function energyWindowStart(
  missionStart: Date,
  now: Date,
  timeZone: string,
  windowDays: number = ENERGY_WINDOW_DAYS
): Date {
  const cutoff = anchorToLocalDay(now, timeZone);
  cutoff.setUTCDate(cutoff.getUTCDate() - (Math.max(1, windowDays) - 1));
  const start = anchorToLocalDay(missionStart, timeZone);
  return cutoff.getTime() > start.getTime() ? cutoff : start;
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
    { data: recoveryActions },
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
      .select('due_at')
      .eq('guardian_id', guardianId)
      .eq('mission_id', missionId)
      .eq('status', 'confirmed')
      .not('recovers_action_id', 'is', null),
    supabase
      .from('mission_actions')
      .select('escalada_points_earned, due_at')
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

  // A energia olha uma janela móvel: o que é mais velho que ela já não pesa,
  // nem contra (faltas) nem a favor (compensações e escalada).
  const windowStart = energyWindowStart(missionStart, now, tz);
  const inWindow = (at: Date | string | null | undefined): boolean => {
    if (!at) return false;
    return anchorToLocalDay(at, tz).getTime() >= windowStart.getTime();
  };

  const escaladaPoints = (confirmedActions ?? [])
    .filter((a) => inWindow(a.due_at))
    .reduce((sum, a) => sum + (a.escalada_points_earned || 0), 0);

  const doneCount = (confirmedActions ?? []).filter((a) => inWindow(a.due_at)).length;
  const recoveryCount = (recoveryActions ?? []).filter((a) => inWindow(a.due_at)).length;

  // Group absences by template — a sequence is per-action, not per-guardian —
  // and only consecutive days form one sequence (2ⁿ − 1 grows with streaks
  // of neglect, not with the total count).
  //
  // `allMissedDates` fica sem filtro de janela de propósito: a constância
  // ("X dias sem falta") conta para trás a partir de hoje e pararia cedo demais
  // se uma falta antiga fosse simplesmente apagada da lista.
  const byTemplate = new Map<string, Date[]>();
  const allMissedDates: Date[] = [];
  let missedInWindow = 0;
  for (const action of missedActions ?? []) {
    const when = action.missed_at ?? action.due_at;
    if (!when) continue;
    const date = anchorToLocalDay(when, tz);
    allMissedDates.push(date);
    if (!inWindow(when)) continue;
    missedInWindow++;
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

  const result = computeEnergy(sequences, recoveryCount, escaladaPoints, {
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
    windowStart: windowStart.toISOString().split('T')[0]!,
    windowDays: ENERGY_WINDOW_DAYS,
    counts: {
      done: doneCount,
      missed: missedInWindow,
      pending: pendingCount ?? 0,
      recoveries: recoveryCount,
      escaladaPoints,
    },
  };
}

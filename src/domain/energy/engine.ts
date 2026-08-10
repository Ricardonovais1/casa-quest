// ============================================================
// Casa Quest — Domain: Energy Engine
// Pure functions for computing energy of commitment.
// ZERO dependencies. ZERO side effects. 100% testable.
// ============================================================

import type {
  AbsenceSequence,
  EnergyConfig,
  EnergyResult,
} from './types';

// ============================================================================
// Core Mathematical Functions
// ============================================================================

/**
 * Calculate sequence energy penalty: E_seq(n) = 2^n - 1
 *
 * This is the primary penalty for a consecutive absence sequence.
 *   n=1 → 1   (one isolated miss)
 *   n=2 → 3   (two consecutive misses hit harder)
 *   n=3 → 7   (three in a row — serious pattern)
 *   n=4 → 15  (habit forming)
 *   n=5 → 31  (systemic problem)
 *
 * The exponential growth reflects that consecutive absences indicate
 * a worsening pattern, not just a sum of individual misses.
 */
export function sequenceEnergy(n: number): number {
  if (n < 1) {
    throw new Error(`sequenceEnergy: n must be >= 1, got ${n}`);
  }
  if (n > 53) {
    // JavaScript integers are safe up to 2^53
    throw new Error(`sequenceEnergy: n too large (${n}), max 53`);
  }
  return Math.pow(2, n) - 1;
}

/**
 * Calculate recurrence penalty: R(k) = 2^k - 1
 *
 * k = number of distinct absence sequences within a mission.
 * Having sequences in multiple action types (e.g., bed AND dishes)
 * is worse than having them all in one area — it shows scattered neglect.
 *
 * The weight parameter (default 0.5) controls how much this contributes.
 */
export function recurrencePenaltyRaw(k: number): number {
  if (k < 0) {
    throw new Error(`recurrencePenalty: k must be >= 0, got ${k}`);
  }
  if (k > 53) {
    throw new Error(`recurrencePenalty: k too large (${k}), max 53`);
  }
  return Math.pow(2, k) - 1;
}

// ============================================================================
// Sequence Detection
// ============================================================================

/**
 * Check if two dates are consecutive calendar days.
 * Two dates are consecutive if date2 is exactly one day after date1.
 */
export function isConsecutiveDay(date1: Date, date2: Date): boolean {
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  const diffMs = d2.getTime() - d1.getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  return diffMs === oneDayMs;
}

/**
 * Group absences into consecutive sequences.
 *
 * Given a sorted list of absence dates (ascending), returns an array of
 * sequences, where each sequence is an array of consecutive dates.
 *
 * Example:
 *   [Jan 1, Jan 2, Jan 3, Jan 5, Jan 6]
 *   → [[Jan 1, Jan 2, Jan 3], [Jan 5, Jan 6]]
 */
export function findConsecutiveSequences(absences: Date[]): Date[][] {
  if (absences.length === 0) return [];

  const sorted = [...absences].sort((a, b) => a.getTime() - b.getTime());
  const sequences: Date[][] = [];
  let currentSequence: Date[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    if (isConsecutiveDay(currentSequence[currentSequence.length - 1]!, sorted[i]!)) {
      currentSequence.push(sorted[i]!);
    } else {
      sequences.push(currentSequence);
      currentSequence = [sorted[i]!];
    }
  }
  sequences.push(currentSequence);

  return sequences;
}

/**
 * Build AbsenceSequence objects from raw date sequences, grouped by
 * action template ID.
 *
 * Each call represents absences for one action template.
 */
export function buildSequences(
  absences: Date[],
  guardianId: string,
  missionId: string,
  actionTemplateId: string
): AbsenceSequence[] {
  const dateSequences = findConsecutiveSequences(absences);
  return dateSequences.map(dates => ({
    guardianId,
    missionId,
    actionTemplateId,
    absenceDates: dates,
    length: dates.length,
  }));
}

// ============================================================================
// Main Energy Computation
// ============================================================================

/**
 * Compute the complete energy result from a list of absences, recovery count,
 * and escalada points.
 *
 * This is the MAIN entry point for energy calculation. It:
 * 1. Groups absences into consecutive sequences
 * 2. Calculates primary energy loss per sequence
 * 3. Applies recurrence penalty for multiple sequences
 * 4. Offsets with recovery energy
 * 5. Adds escalada bonus points
 *
 * @param allSequences - All absence sequences across all action templates
 * @param recoveries - Number of recovery actions completed
 * @param escaladaPoints - Total points earned from escalada actions
 * @param config - Energy configuration parameters
 */
export function computeEnergy(
  allSequences: AbsenceSequence[],
  recoveries: number,
  escaladaPoints: number,
  config: EnergyConfig
): EnergyResult {
  // 1. Calculate primary loss: sum of sequence penalties
  let primaryLoss = 0;
  for (const seq of allSequences) {
    primaryLoss += sequenceEnergy(seq.length);
  }

  // 2. Count distinct sequences and calculate recurrence penalty
  const sequenceCount = allSequences.length;
  const rawRecurrence = recurrencePenaltyRaw(sequenceCount);
  const recurrencePenalty = Math.round(rawRecurrence * config.recurrenceWeight * 100) / 100;

  // 3. Total loss = primary + recurrence
  const totalLoss = primaryLoss + recurrencePenalty;

  // 4. Recovery: each recovery action restores config.recoveryValue energy
  //    Limited to 1 recovery per absence (not per sequence)
  const totalAbsences = allSequences.reduce((sum, seq) => sum + seq.length, 0);
  const effectiveRecoveries = Math.min(recoveries, totalAbsences);
  const totalRecovery = effectiveRecoveries * config.recoveryValue;

  // 5. Net loss: cannot be negative (recovery can't overshoot the loss)
  const netLoss = Math.max(0, totalLoss - totalRecovery);

  // 6. Final energy: start from initial, subtract net loss, add escalada
  //    Escalada CAN push energy above the initial value (100+)
  const finalEnergy = config.initialEnergy - netLoss + escaladaPoints;

  return {
    primaryLoss,
    recurrencePenalty,
    totalLoss,
    totalRecovery,
    netLoss,
    escaladaPoints,
    finalEnergy,
    sequences: allSequences,
    sequenceCount,
  };
}

// ============================================================================
// Utility: Qualitative State
// ============================================================================

import { EnergyQualitativeState } from './types';
import type { QualitativeStateInfo } from './types';

/**
 * Map a final energy value (relative to initial) to a qualitative state.
 * @param finalEnergy - The computed final energy
 * @param initialEnergy - The starting energy (default 100)
 */
export function getQualitativeState(
  finalEnergy: number,
  initialEnergy: number
): QualitativeStateInfo {
  const percentage = (finalEnergy / initialEnergy) * 100;

  if (percentage > 100) {
    return {
      state: EnergyQualitativeState.EXCEPTIONAL,
      label: 'Excepcional',
      emoji: '🌟',
      color: 'text-purple-600',
    };
  }
  if (percentage >= 90) {
    return {
      state: EnergyQualitativeState.EXCELLENT,
      label: 'Compromisso Forte',
      emoji: '🟢',
      color: 'text-emerald-600',
    };
  }
  if (percentage >= 70) {
    return {
      state: EnergyQualitativeState.GOOD,
      label: 'Atenção',
      emoji: '🟡',
      color: 'text-yellow-600',
    };
  }
  if (percentage >= 50) {
    return {
      state: EnergyQualitativeState.NEEDS_ATTENTION,
      label: 'Em Recuperação',
      emoji: '🟠',
      color: 'text-orange-600',
    };
  }
  if (percentage >= 30) {
    return {
      state: EnergyQualitativeState.AT_RISK,
      label: 'Precisa Melhorar',
      emoji: '🔴',
      color: 'text-red-500',
    };
  }
  return {
    state: EnergyQualitativeState.CRITICAL,
    label: 'Precisa Melhorar',
    emoji: '🔴',
    color: 'text-red-700',
  };
}

/**
 * Get the energy percentage as a number 0-100+ (can exceed 100 with escalada)
 */
export function getEnergyPercentage(
  finalEnergy: number,
  initialEnergy: number
): number {
  return Math.round((finalEnergy / initialEnergy) * 100);
}

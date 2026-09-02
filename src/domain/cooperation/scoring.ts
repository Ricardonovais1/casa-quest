// ============================================================
// Casa Quest — Domain: Cooperation Scoring
// Pure functions for computing cooperation scores.
// ============================================================

import type { CooperationEvent } from './types';

/**
 * Compute total cooperation score from an ordered list of events.
 * Simply sums all score deltas.
 *
 * @param events - Chronologically ordered cooperation events
 * @returns Total cooperation score (can be negative if manual adjustments reduce it)
 */
export function computeCooperationScore(
  events: readonly CooperationEvent[]
): number {
  return events.reduce((total, event) => total + event.scoreDelta, 0);
}

/**
 * Calculate the cooperation level as a qualitative indicator.
 * This is separate from the raw score — it's for display purposes.
 */
export function getCooperationLevel(score: number): {
  level: string;
  emoji: string;
  description: string;
} {
  if (score >= 20) {
    return {
      level: 'Lendário',
      emoji: '👑',
      description: 'Ajudante lendário da família!',
    };
  }
  if (score >= 10) {
    return {
      level: 'Excelente',
      emoji: '🤝',
      description: 'Grande espírito de equipe!',
    };
  }
  if (score >= 5) {
    return {
      level: 'Bom',
      emoji: '👍',
      description: 'Boa cooperação com a família.',
    };
  }
  if (score >= 1) {
    return {
      level: 'Iniciante',
      emoji: '🌱',
      description: 'Começando a cooperar!',
    };
  }
  return {
    level: 'Individual',
    emoji: '🧍',
    description: 'Hora de ajudar alguém!',
  };
}

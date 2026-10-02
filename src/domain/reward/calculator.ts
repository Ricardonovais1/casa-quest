// ============================================================
// Casa Quest — Domain: Reward Calculator
// Pure functions to convert energy → reward.
// NEVER shown to guardians — Mor's administrative view only.
// ============================================================

import type { RewardResult, RewardConfig } from './types';
import { MIN_REWARD_PERCENT } from './types';

const DEFAULT_CONFIG: RewardConfig = {
  minRewardPercent: MIN_REWARD_PERCENT,
  cooperationBonusPercent: 2, // 2% bonus per 10 cooperation points
};

const round1 = (n: number) => Math.round(n * 10) / 10;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Share of the target reward earned for a given energy percentage.
 *
 * DECISION (2026-10-02): the reward follows the energy point by point —
 * 83.5% of energy pays 83.5% — between a floor and 100%. It used to be a
 * five-step ladder (90+ → 100%, 70–89 → 80%, …). On a ladder one energy point
 * is worth 20% of the allowance at the edge and nothing in the middle of a
 * band: Ricardo's three daughters ended September with 89.5 / 83.5 / 66 and
 * were paid 100% / 80% / 60% — and the first one's 89.5 even DISPLAYED as 90,
 * because the tier was picked from the rounded number. Do not bring cliffs
 * back; the tests pin that two close energies pay close rewards.
 *
 * Escalada can push energy above 100; the reward is capped at 100%.
 */
export function rewardPercentFor(
  energyPercent: number,
  minRewardPercent: number = MIN_REWARD_PERCENT
): number {
  return Math.min(100, Math.max(minRewardPercent, energyPercent));
}

/**
 * Calculate the cooperation bonus amount.
 * Default: each 10 cooperation points adds config.cooperationBonusPercent% to the reward.
 */
export function calculateCooperationBonus(
  cooperationScore: number,
  targetReward: number,
  bonusPercentPer10: number = 2
): number {
  if (cooperationScore <= 0 || targetReward <= 0) return 0;

  const bonusUnits = Math.floor(cooperationScore / 10);
  const bonusPercent = bonusUnits * bonusPercentPer10;

  return Math.round((targetReward * bonusPercent) / 100 * 100) / 100;
}

/**
 * Main reward calculation.
 *
 * @param finalEnergy - The guardian's final energy (from energy engine)
 * @param initialEnergy - Starting energy (default 100)
 * @param targetReward - The target monetary reward for this guardian
 * @param cooperationScore - Accumulated cooperation points (0-100+)
 * @param config - Optional reward configuration
 */
export function calculateReward(
  finalEnergy: number,
  initialEnergy: number,
  targetReward: number,
  cooperationScore: number,
  config: RewardConfig = DEFAULT_CONFIG
): RewardResult {
  if (initialEnergy <= 0) {
    throw new Error(`calculateReward: initialEnergy must be > 0, got ${initialEnergy}`);
  }

  // Not rounded to a whole number first: 89.5 must not turn into 90.
  const energyPercent = (finalEnergy / initialEnergy) * 100;
  const rewardPercent = rewardPercentFor(energyPercent, config.minRewardPercent);

  const baseReward = Math.round((targetReward * rewardPercent) / 100 * 100) / 100;

  const cooperationBonus = calculateCooperationBonus(
    cooperationScore,
    targetReward,
    config.cooperationBonusPercent
  );

  const totalReward = Math.round((baseReward + cooperationBonus) * 100) / 100;

  return {
    energyPercent: round1(energyPercent),
    rewardPercent: round1(rewardPercent),
    baseReward,
    cooperationBonus,
    totalReward,
    cooperationScore,
  };
}

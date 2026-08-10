// ============================================================
// Casa Quest — Domain: Reward Calculator
// Pure functions to convert energy → reward.
// NEVER shown to guardians — Mor's administrative view only.
// ============================================================

import type { RewardResult, RewardTier, RewardConfig } from './types';
import { DEFAULT_REWARD_TIERS } from './types';

const DEFAULT_CONFIG: RewardConfig = {
  tiers: DEFAULT_REWARD_TIERS,
  cooperationBonusPercent: 2, // 2% bonus per 10 cooperation points
};

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Find the matching reward tier for a given energy percentage.
 * Tiers are evaluated in order; first match wins.
 */
export function findRewardTier(
  energyPercent: number,
  tiers: readonly RewardTier[] = DEFAULT_REWARD_TIERS
): RewardTier {
  for (const tier of tiers) {
    if (energyPercent >= tier.minEnergyPercent && energyPercent <= tier.maxEnergyPercent) {
      return tier;
    }
  }
  // Fallback: return the lowest tier
  return tiers[tiers.length - 1]!;
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

  const energyPercent = Math.round((finalEnergy / initialEnergy) * 100);
  const tier = findRewardTier(energyPercent, config.tiers);

  // Base reward from tier
  const baseReward = Math.round((targetReward * tier.rewardPercent) / 100 * 100) / 100;

  // Cooperation bonus
  const cooperationBonus = calculateCooperationBonus(
    cooperationScore,
    targetReward,
    config.cooperationBonusPercent
  );

  const totalReward = Math.round((baseReward + cooperationBonus) * 100) / 100;

  return {
    energyPercent,
    tier,
    baseReward,
    cooperationBonus,
    totalReward,
    cooperationScore,
  };
}

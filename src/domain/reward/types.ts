// ============================================================
// Casa Quest — Domain: Reward Types
// Reward calculation types. Rewards are for Mor's eyes only.
// ============================================================

/** Result of reward calculation */
export interface RewardResult {
  energyPercent: number;       // finalEnergy as percentage of initialEnergy (1 decimal)
  rewardPercent: number;       // share of the target reward earned (floor..100, 1 decimal)
  baseReward: number;          // target * rewardPercent / 100
  cooperationBonus: number;    // extra from cooperation score
  totalReward: number;         // baseReward + cooperationBonus
  cooperationScore: number;    // input cooperation score (for audit)
}

/**
 * Lowest share of the target reward a guardian can earn. Showing up at all
 * is never worth zero; below this the energy stops mattering.
 */
export const MIN_REWARD_PERCENT = 20;

/** Configuration for reward calculation */
export interface RewardConfig {
  minRewardPercent: number;
  cooperationBonusPercent: number; // bonus % per 10 cooperation points (default 2)
}

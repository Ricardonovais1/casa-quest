// ============================================================
// Casa Quest — Domain: Reward Types
// Reward calculation types. Rewards are for Mor's eyes only.
// ============================================================

/** A single reward tier band */
export interface RewardTier {
  minEnergyPercent: number;   // inclusive lower bound
  maxEnergyPercent: number;   // inclusive upper bound (use Infinity for top tier)
  rewardPercent: number;       // percentage of target reward (0-100)
}

/** Result of reward calculation */
export interface RewardResult {
  energyPercent: number;       // finalEnergy as percentage of initialEnergy
  tier: RewardTier;            // the tier that was applied
  baseReward: number;          // target * tier.rewardPercent / 100
  cooperationBonus: number;    // extra from cooperation score
  totalReward: number;         // baseReward + cooperationBonus
  cooperationScore: number;    // input cooperation score (for audit)
}

/** Default reward tiers — can be customized per family */
export const DEFAULT_REWARD_TIERS: readonly RewardTier[] = [
  { minEnergyPercent: 90, maxEnergyPercent: Infinity, rewardPercent: 100 },
  { minEnergyPercent: 70, maxEnergyPercent: 89,      rewardPercent: 80  },
  { minEnergyPercent: 50, maxEnergyPercent: 69,      rewardPercent: 60  },
  { minEnergyPercent: 30, maxEnergyPercent: 49,      rewardPercent: 40  },
  { minEnergyPercent: 0,  maxEnergyPercent: 29,      rewardPercent: 20  },
];

/** Configuration for reward calculation */
export interface RewardConfig {
  tiers: readonly RewardTier[];
  cooperationBonusPercent: number; // bonus % per 10 cooperation points (default 2)
}

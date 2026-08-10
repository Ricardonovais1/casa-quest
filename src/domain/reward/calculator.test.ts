// ============================================================
// Casa Quest — Domain: Reward Calculator Tests
// ============================================================

import { calculateReward, findRewardTier, calculateCooperationBonus } from './calculator';
import { DEFAULT_REWARD_TIERS } from './types';

describe('findRewardTier', () => {
  it('90% → 100% reward tier', () => {
    const tier = findRewardTier(90);
    expect(tier.rewardPercent).toBe(100);
  });

  it('95% → 100% reward tier', () => {
    const tier = findRewardTier(95);
    expect(tier.rewardPercent).toBe(100);
  });

  it('80% → 80% reward tier', () => {
    const tier = findRewardTier(80);
    expect(tier.rewardPercent).toBe(80);
  });

  it('70% → 80% reward tier (boundary)', () => {
    const tier = findRewardTier(70);
    expect(tier.rewardPercent).toBe(80);
  });

  it('60% → 60% reward tier', () => {
    const tier = findRewardTier(60);
    expect(tier.rewardPercent).toBe(60);
  });

  it('40% → 40% reward tier', () => {
    const tier = findRewardTier(40);
    expect(tier.rewardPercent).toBe(40);
  });

  it('20% → 20% reward tier', () => {
    const tier = findRewardTier(20);
    expect(tier.rewardPercent).toBe(20);
  });

  it('5% → 20% reward tier (lowest)', () => {
    const tier = findRewardTier(5);
    expect(tier.rewardPercent).toBe(20);
  });

  it('0% → 20% reward tier', () => {
    const tier = findRewardTier(0);
    expect(tier.rewardPercent).toBe(20);
  });

  it('negative → 20% reward tier', () => {
    const tier = findRewardTier(-10);
    expect(tier.rewardPercent).toBe(20);
  });
});

describe('calculateCooperationBonus', () => {
  it('0 cooperation → 0 bonus', () => {
    expect(calculateCooperationBonus(0, 100)).toBe(0);
  });

  it('10 cooperation → 2% bonus on R$100 = R$2', () => {
    expect(calculateCooperationBonus(10, 100, 2)).toBe(2);
  });

  it('20 cooperation → 4% bonus on R$100 = R$4', () => {
    expect(calculateCooperationBonus(20, 100, 2)).toBe(4);
  });

  it('35 cooperation → floor(35/10)=3 units × 2% = 6% = R$6', () => {
    expect(calculateCooperationBonus(35, 100, 2)).toBe(6);
  });

  it('5 cooperation (< 10) → 0 bonus', () => {
    expect(calculateCooperationBonus(5, 100, 2)).toBe(0);
  });
});

describe('calculateReward', () => {
  it('100 energy, R$50 target, 0 coop → R$50 total', () => {
    const result = calculateReward(100, 100, 50, 0);
    expect(result.baseReward).toBe(50);
    expect(result.cooperationBonus).toBe(0);
    expect(result.totalReward).toBe(50);
  });

  it('80 energy, R$50 target → 80% tier → R$40 base', () => {
    const result = calculateReward(80, 100, 50, 0);
    expect(result.energyPercent).toBe(80);
    expect(result.tier.rewardPercent).toBe(80);
    expect(result.baseReward).toBe(40);
  });

  it('60 energy, R$100 target → 60% tier → R$60 base', () => {
    const result = calculateReward(60, 100, 100, 0);
    expect(result.baseReward).toBe(60);
  });

  it('25 energy, R$50 target → 20% tier → R$10 base', () => {
    const result = calculateReward(25, 100, 50, 0);
    expect(result.tier.rewardPercent).toBe(20);
    expect(result.baseReward).toBe(10);
  });

  it('95 energy + 20 coop → 100% reward + 4% bonus = R$52 on R$50', () => {
    const result = calculateReward(95, 100, 50, 20);
    expect(result.baseReward).toBe(50);
    expect(result.cooperationBonus).toBe(2); // 20/10 * 2% * 50 = 2
    expect(result.totalReward).toBe(52);
  });

  it('105 energy (escalada) → 100% reward tier', () => {
    const result = calculateReward(105, 100, 50, 0);
    expect(result.energyPercent).toBe(105);
    expect(result.tier.rewardPercent).toBe(100);
    expect(result.baseReward).toBe(50);
  });

  it('throws for zero initialEnergy', () => {
    expect(() => calculateReward(50, 0, 50, 0)).toThrow('initialEnergy must be > 0');
  });

  it('throws for negative initialEnergy', () => {
    expect(() => calculateReward(50, -10, 50, 0)).toThrow('initialEnergy must be > 0');
  });

  it('custom tiers are respected', () => {
    const customTiers = [
      { minEnergyPercent: 80, maxEnergyPercent: Infinity, rewardPercent: 100 },
      { minEnergyPercent: 50, maxEnergyPercent: 79, rewardPercent: 75 },
      { minEnergyPercent: 0, maxEnergyPercent: 49, rewardPercent: 50 },
    ];
    const result = calculateReward(70, 100, 100, 0, {
      tiers: customTiers,
      cooperationBonusPercent: 2,
    });
    expect(result.tier.rewardPercent).toBe(75);
    expect(result.baseReward).toBe(75);
  });
});

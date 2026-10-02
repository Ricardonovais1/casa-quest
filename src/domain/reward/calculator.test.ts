// ============================================================
// Casa Quest — Domain: Reward Calculator Tests
// ============================================================

import { calculateReward, rewardPercentFor, calculateCooperationBonus } from './calculator';

describe('rewardPercentFor', () => {
  it('follows the energy point by point', () => {
    expect(rewardPercentFor(83.5)).toBe(83.5);
    expect(rewardPercentFor(66)).toBe(66);
  });

  it('has no cliffs: close energies pay close rewards', () => {
    // The old ladder paid 100% at 90 and 80% at 89 — a 20-point drop for one point.
    expect(Math.abs(rewardPercentFor(90) - rewardPercentFor(89))).toBeLessThanOrEqual(1);
    expect(Math.abs(rewardPercentFor(70) - rewardPercentFor(69))).toBeLessThanOrEqual(1);
  });

  it('caps at 100% even with escalada energy', () => {
    expect(rewardPercentFor(105)).toBe(100);
  });

  it('never goes below the floor', () => {
    expect(rewardPercentFor(5)).toBe(20);
    expect(rewardPercentFor(-72)).toBe(20);
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

  it('80 energy, R$50 target → 80% → R$40 base', () => {
    const result = calculateReward(80, 100, 50, 0);
    expect(result.energyPercent).toBe(80);
    expect(result.rewardPercent).toBe(80);
    expect(result.baseReward).toBe(40);
  });

  it('60 energy, R$100 target → 60% → R$60 base', () => {
    const result = calculateReward(60, 100, 100, 0);
    expect(result.baseReward).toBe(60);
  });

  it('10 energy, R$50 target → floor of 20% → R$10 base', () => {
    const result = calculateReward(10, 100, 50, 0);
    expect(result.rewardPercent).toBe(20);
    expect(result.baseReward).toBe(10);
  });

  it('95 energy + 20 coop → 95% reward + 4% bonus = R$49.50 on R$50', () => {
    const result = calculateReward(95, 100, 50, 20);
    expect(result.baseReward).toBe(47.5);
    expect(result.cooperationBonus).toBe(2); // 20/10 * 2% * 50 = 2
    expect(result.totalReward).toBe(49.5);
  });

  it('105 energy (escalada) → capped at 100% reward', () => {
    const result = calculateReward(105, 100, 50, 0);
    expect(result.energyPercent).toBe(105);
    expect(result.rewardPercent).toBe(100);
    expect(result.baseReward).toBe(50);
  });

  it('throws for zero initialEnergy', () => {
    expect(() => calculateReward(50, 0, 50, 0)).toThrow('initialEnergy must be > 0');
  });

  it('throws for negative initialEnergy', () => {
    expect(() => calculateReward(50, -10, 50, 0)).toThrow('initialEnergy must be > 0');
  });

  it('89.5 energy is not rounded up to 90 (September 2026 regression)', () => {
    const result = calculateReward(89.5, 100, 80, 0);
    expect(result.energyPercent).toBe(89.5);
    expect(result.baseReward).toBe(71.6);
  });

  it('a custom floor is respected', () => {
    const result = calculateReward(10, 100, 100, 0, { minRewardPercent: 50, cooperationBonusPercent: 2 });
    expect(result.baseReward).toBe(50);
  });
});

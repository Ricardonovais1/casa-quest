// ============================================================
// Casa Quest — Tests: constância (dias seguidos sem falta)
// ============================================================

import { computeStreakDays } from './guardian-energy';

const d = (s: string) => new Date(`${s}T12:00:00Z`);

describe('computeStreakDays', () => {
  const start = d('2026-08-01');
  const today = d('2026-08-10');

  it('counts every day since the mission start when nothing was missed', () => {
    // 1st through 10th inclusive.
    expect(computeStreakDays([], start, today)).toBe(10);
  });

  it('stops at the most recent miss', () => {
    // Missed on the 7th → streak covers 8, 9, 10.
    expect(computeStreakDays([d('2026-08-07')], start, today)).toBe(3);
  });

  it('is zero when today itself was missed', () => {
    expect(computeStreakDays([d('2026-08-10')], start, today)).toBe(0);
  });

  it('ignores misses older than the most recent one', () => {
    const missed = [d('2026-08-02'), d('2026-08-03'), d('2026-08-08')];
    // Only the 8th matters → 9 and 10 remain.
    expect(computeStreakDays(missed, start, today)).toBe(2);
  });

  it('never counts back past the mission start', () => {
    const lateStart = d('2026-08-09');
    expect(computeStreakDays([], lateStart, today)).toBe(2);
  });

  it('handles a mission that starts today', () => {
    expect(computeStreakDays([], today, today)).toBe(1);
  });

  it('does not run away on a long clean mission', () => {
    const ancient = d('2020-01-01');
    expect(computeStreakDays([], ancient, today)).toBe(365);
  });
});

// ============================================================
// Casa Quest — Tests: janela móvel da energia
// ============================================================

import { energyWindowStart, ENERGY_WINDOW_DAYS } from './guardian-energy';

const TZ = 'America/Sao_Paulo';
const day = (at: Date) => at.toISOString().split('T')[0];

describe('energyWindowStart', () => {
  const today = d('2026-09-10');

  it('counts back ENERGY_WINDOW_DAYS from today, today included', () => {
    expect(ENERGY_WINDOW_DAYS).toBe(30);
    // 30 days ending on the 10th → starts on 12 Aug.
    expect(day(energyWindowStart(d('2026-01-01'), today, TZ))).toBe('2026-08-12');
  });

  it('never starts before the mission did', () => {
    expect(day(energyWindowStart(d('2026-09-08'), today, TZ))).toBe('2026-09-08');
  });

  it('is today for a mission that starts today', () => {
    expect(day(energyWindowStart(today, today, TZ))).toBe('2026-09-10');
  });

  it('honours a custom window length', () => {
    expect(day(energyWindowStart(d('2026-01-01'), today, TZ, 7))).toBe('2026-09-04');
  });

  it('treats a zero or negative window as a single day', () => {
    expect(day(energyWindowStart(d('2026-01-01'), today, TZ, 0))).toBe('2026-09-10');
  });
});

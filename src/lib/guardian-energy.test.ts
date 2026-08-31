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

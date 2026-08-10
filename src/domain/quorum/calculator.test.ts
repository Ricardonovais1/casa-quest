// ============================================================
// Casa Quest — Domain: Quorum Calculator Tests
// ============================================================

import {
  calculateQuorum,
  isQuorumMet,
  getEligibleConfirmers,
  canConfirm,
  DEFAULT_QUORUM_CONFIG,
} from './calculator';
import type { QuorumConfig } from './calculator';

function guardian(id: string, isActive = true, isMor = false) {
  return { id, isActive, isMor };
}

describe('calculateQuorum', () => {
  it('family of 2 (1 eligible) → 1 confirmer (dynamic)', () => {
    // 1 eligible + 1 owner = 2 family members → below threshold 3 → small family → 1
    expect(calculateQuorum(DEFAULT_QUORUM_CONFIG, 1)).toBe(1);
  });

  it('family of 3 (2 eligible) → 2 confirmers (dynamic)', () => {
    // 2 eligible + 1 owner = 3 family members → at threshold → large family → 2
    expect(calculateQuorum(DEFAULT_QUORUM_CONFIG, 2)).toBe(2);
  });

  it('family of 5 (4 eligible) → 2 confirmers (dynamic)', () => {
    expect(calculateQuorum(DEFAULT_QUORUM_CONFIG, 4)).toBe(2);
  });

  it('fixed quorum of 1', () => {
    const config: QuorumConfig = { ...DEFAULT_QUORUM_CONFIG, quorumType: 'fixed', quorumFixed: 1 };
    expect(calculateQuorum(config, 4)).toBe(1);
  });

  it('fixed quorum of 3', () => {
    const config: QuorumConfig = { ...DEFAULT_QUORUM_CONFIG, quorumType: 'fixed', quorumFixed: 3 };
    expect(calculateQuorum(config, 4)).toBe(3);
  });

  it('caps at eligible count (fixed 5 but only 2 eligible → 2)', () => {
    const config: QuorumConfig = { ...DEFAULT_QUORUM_CONFIG, quorumType: 'fixed', quorumFixed: 5 };
    expect(calculateQuorum(config, 2)).toBe(2);
  });

  it('single eligible confirmer → always 1', () => {
    expect(calculateQuorum(DEFAULT_QUORUM_CONFIG, 1)).toBe(1);
  });

  it('0 eligible (edge case) → 1 (minimum)', () => {
    expect(calculateQuorum(DEFAULT_QUORUM_CONFIG, 0)).toBe(1);
  });
});

describe('isQuorumMet', () => {
  it('0 of 2 → false', () => {
    expect(isQuorumMet(0, 2)).toBe(false);
  });

  it('1 of 2 → false', () => {
    expect(isQuorumMet(1, 2)).toBe(false);
  });

  it('2 of 2 → true', () => {
    expect(isQuorumMet(2, 2)).toBe(true);
  });

  it('1 of 1 → true', () => {
    expect(isQuorumMet(1, 1)).toBe(true);
  });

  it('3 of 2 → true (exceeds)', () => {
    expect(isQuorumMet(3, 2)).toBe(true);
  });
});

describe('getEligibleConfirmers', () => {
  const guardians = [
    guardian('g1', true, false),  // action owner
    guardian('g2', true, false),
    guardian('g3', true, true),   // Mor
    guardian('g4', false, false), // inactive
  ];

  it('excludes the action owner', () => {
    const eligible = getEligibleConfirmers('g1', guardians);
    expect(eligible).not.toContain('g1');
  });

  it('includes Mor', () => {
    const eligible = getEligibleConfirmers('g1', guardians);
    expect(eligible).toContain('g3');
  });

  it('excludes inactive guardians', () => {
    const eligible = getEligibleConfirmers('g1', guardians);
    expect(eligible).not.toContain('g4');
  });

  it('returns active non-owner guardians', () => {
    const eligible = getEligibleConfirmers('g1', guardians);
    expect(eligible).toEqual(['g2', 'g3']);
  });
});

describe('canConfirm', () => {
  it('other guardian can confirm', () => {
    expect(canConfirm('g2', 'g1')).toBe(true);
  });

  it('self-confirmation denied by default', () => {
    expect(canConfirm('g1', 'g1')).toBe(false);
  });

  it('self-confirmation allowed when configured', () => {
    expect(canConfirm('g1', 'g1', true)).toBe(true);
  });

  it('Mor can confirm any action (except own)', () => {
    expect(canConfirm('g3', 'g1')).toBe(true);
  });
});

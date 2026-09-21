// ============================================================
// Casa Quest — Domain: Energy Engine Tests
// Mandatory test cases from spec section 31 + comprehensive coverage
// ============================================================

import {
  sequenceEnergy,
  recurrencePenaltyRaw,
  findConsecutiveSequences,
  isConsecutiveDay,
  computeEnergy,
  getQualitativeState,
  getEnergyPercentage,
} from './engine';
import type { AbsenceSequence, EnergyConfig } from './types';

// ============================================================================
// Test Helpers
// ============================================================================

function date(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d); // month is 0-indexed
}

function makeSequence(
  dates: Date[],
  guardianId = 'g1',
  missionId = 'm1',
  templateId = 't1'
): AbsenceSequence {
  return {
    guardianId,
    missionId,
    actionTemplateId: templateId,
    absenceDates: dates,
    length: dates.length,
  };
}

const defaultConfig: EnergyConfig = {
  initialEnergy: 100,
  recurrenceWeight: 0.5,
  recoveryValue: 2,
};

// ============================================================================
// sequenceEnergy
// ============================================================================

describe('sequenceEnergy', () => {
  it('n=1 → 1', () => {
    expect(sequenceEnergy(1)).toBe(1);
  });

  it('n=2 → 3', () => {
    expect(sequenceEnergy(2)).toBe(3);
  });

  it('n=3 → 7', () => {
    expect(sequenceEnergy(3)).toBe(7);
  });

  it('n=4 → 15', () => {
    expect(sequenceEnergy(4)).toBe(15);
  });

  it('n=5 → 31', () => {
    expect(sequenceEnergy(5)).toBe(31);
  });

  it('throws for n=0', () => {
    expect(() => sequenceEnergy(0)).toThrow('n must be >= 1');
  });

  it('throws for negative n', () => {
    expect(() => sequenceEnergy(-1)).toThrow('n must be >= 1');
  });

  it('handles n=10 → 1023', () => {
    expect(sequenceEnergy(10)).toBe(1023);
  });
});

// ============================================================================
// recurrencePenaltyRaw
// ============================================================================

describe('recurrencePenaltyRaw', () => {
  it('k=0 → 0', () => {
    expect(recurrencePenaltyRaw(0)).toBe(0);
  });

  it('k=1 → 1', () => {
    expect(recurrencePenaltyRaw(1)).toBe(1);
  });

  it('k=2 → 2', () => {
    expect(recurrencePenaltyRaw(2)).toBe(2);
  });

  it('k=3 → 3', () => {
    expect(recurrencePenaltyRaw(3)).toBe(3);
  });

  it('é linear, não exponencial — k=17 → 17, não 131071', () => {
    expect(recurrencePenaltyRaw(17)).toBe(17);
  });

  it('throws for negative k', () => {
    expect(() => recurrencePenaltyRaw(-1)).toThrow('k must be >= 0');
  });
});

// ============================================================================
// isConsecutiveDay
// ============================================================================

describe('isConsecutiveDay', () => {
  it('day after is consecutive', () => {
    expect(isConsecutiveDay(date(2026, 1, 1), date(2026, 1, 2))).toBe(true);
  });

  it('same day is not consecutive', () => {
    expect(isConsecutiveDay(date(2026, 1, 1), date(2026, 1, 1))).toBe(false);
  });

  it('two days after is not consecutive', () => {
    expect(isConsecutiveDay(date(2026, 1, 1), date(2026, 1, 3))).toBe(false);
  });

  it('day before is not consecutive (order matters)', () => {
    expect(isConsecutiveDay(date(2026, 1, 2), date(2026, 1, 1))).toBe(false);
  });

  it('across month boundary', () => {
    expect(isConsecutiveDay(date(2026, 1, 31), date(2026, 2, 1))).toBe(true);
  });

  it('across year boundary', () => {
    expect(isConsecutiveDay(date(2025, 12, 31), date(2026, 1, 1))).toBe(true);
  });
});

// ============================================================================
// findConsecutiveSequences
// ============================================================================

describe('findConsecutiveSequences', () => {
  it('empty absences → empty sequences', () => {
    expect(findConsecutiveSequences([])).toEqual([]);
  });

  it('single absence → one sequence of length 1', () => {
    const result = findConsecutiveSequences([date(2026, 1, 1)]);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(1);
  });

  it('two isolated absences → two sequences', () => {
    const result = findConsecutiveSequences([
      date(2026, 1, 1),
      date(2026, 1, 3),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(1);
    expect(result[1]).toHaveLength(1);
  });

  it('three consecutive → one sequence of length 3', () => {
    const result = findConsecutiveSequences([
      date(2026, 1, 1),
      date(2026, 1, 2),
      date(2026, 1, 3),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(3);
  });

  it('mixed: [1,2,3] and [5,6] → two sequences', () => {
    const result = findConsecutiveSequences([
      date(2026, 1, 1),
      date(2026, 1, 2),
      date(2026, 1, 3),
      date(2026, 1, 5),
      date(2026, 1, 6),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(3);
    expect(result[1]).toHaveLength(2);
  });

  it('handles unsorted input', () => {
    const result = findConsecutiveSequences([
      date(2026, 1, 3),
      date(2026, 1, 1),
      date(2026, 1, 2),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(3);
  });
});

// ============================================================================
// computeEnergy — Main Scenarios from Spec Section 31
// ============================================================================

describe('computeEnergy', () => {
  // --- Faltas & Sequências ---

  it('Nenhuma falta → energia 100', () => {
    const result = computeEnergy([], 0, 0, defaultConfig);
    expect(result.finalEnergy).toBe(100);
    expect(result.primaryLoss).toBe(0);
    expect(result.recurrencePenalty).toBe(0);
    expect(result.netLoss).toBe(0);
  });

  it('Duas faltas isoladas em dias não consecutivos → penalidade = 1+1 = 2', () => {
    // Two separate sequences, each of length 1
    const sequences = [
      makeSequence([date(2026, 1, 1)], 'g1', 'm1', 't1'),
      makeSequence([date(2026, 1, 5)], 'g1', 'm1', 't1'),
    ];
    const result = computeEnergy(sequences, 0, 0, defaultConfig);
    // primaryLoss: 2^1-1 + 2^1-1 = 1 + 1 = 2
    // recurrence: k=2 → 2, weight 0.5 → 1
    // totalLoss: 2 + 1 = 3
    // finalEnergy: 100 - 3 = 97
    expect(result.primaryLoss).toBe(2);
    expect(result.recurrencePenalty).toBe(1);
    expect(result.totalLoss).toBe(3);
    expect(result.finalEnergy).toBe(97);
  });

  it('Três faltas consecutivas → penalidade primária = 7 (n=3)', () => {
    const sequences = [
      makeSequence([
        date(2026, 1, 1),
        date(2026, 1, 2),
        date(2026, 1, 3),
      ], 'g1', 'm1', 't1'),
    ];
    const result = computeEnergy(sequences, 0, 0, defaultConfig);
    // primaryLoss: 2^3-1 = 7
    // recurrence: k=1 → 2^1-1=1, weight 0.5 → 0.5
    // totalLoss: 7 + 0.5 = 7.5
    // finalEnergy: 100 - 7.5 = 92.5
    expect(result.primaryLoss).toBe(7);
    expect(result.recurrencePenalty).toBe(0.5);
    expect(result.totalLoss).toBe(7.5);
    expect(result.finalEnergy).toBe(92.5);
  });

  it('Duas sequências de 2 faltas cada → primária 3+3=6, reincidência k=2→2, peso 0.5→1; total 7', () => {
    const sequences = [
      makeSequence([date(2026, 1, 1), date(2026, 1, 2)], 'g1', 'm1', 't1'),
      makeSequence([date(2026, 1, 5), date(2026, 1, 6)], 'g1', 'm1', 't1'),
    ];
    const result = computeEnergy(sequences, 0, 0, defaultConfig);
    // primaryLoss: (2^2-1) + (2^2-1) = 3 + 3 = 6
    // recurrence: k=2 → 2, weight 0.5 → 1
    // totalLoss: 6 + 1 = 7
    expect(result.primaryLoss).toBe(6);
    expect(result.recurrencePenalty).toBe(1);
    expect(result.totalLoss).toBe(7);
    expect(result.finalEnergy).toBe(93);
  });

  it('Falta única isolada → penalidade primária = 1', () => {
    const sequences = [
      makeSequence([date(2026, 1, 1)], 'g1', 'm1', 't1'),
    ];
    const result = computeEnergy(sequences, 0, 0, defaultConfig);
    expect(result.primaryLoss).toBe(1);
    expect(result.recurrencePenalty).toBe(0.5); // k=1: 1*0.5 = 0.5
    expect(result.totalLoss).toBe(1.5);
    expect(result.finalEnergy).toBe(98.5);
  });

  // --- Recuperação ---

  it('Uma falta (-1) + uma recuperação (+2) → energia final: 101 (perda zerada)', () => {
    const sequences = [
      makeSequence([date(2026, 1, 1)], 'g1', 'm1', 't1'),
    ];
    const result = computeEnergy(sequences, 1, 0, defaultConfig);
    // primaryLoss: 1, recurrence: 0.5, totalLoss: 1.5
    // totalRecovery: min(1,1) * 2 = 2
    // netLoss: max(0, 1.5 - 2) = 0
    // finalEnergy: 100 - 0 + 0 = 100
    expect(result.totalRecovery).toBe(2);
    expect(result.netLoss).toBe(0);
    expect(result.finalEnergy).toBe(100);
  });

  it('Recuperação reduz a perda líquida mas não fica negativa', () => {
    const sequences = [
      makeSequence([date(2026, 1, 1)], 'g1', 'm1', 't1'),
    ];
    // 5 recoveries but only 1 absence — capped at 1
    const result = computeEnergy(sequences, 5, 0, defaultConfig);
    expect(result.totalRecovery).toBe(2); // only 1 effective recovery
    expect(result.netLoss).toBe(0);
    expect(result.finalEnergy).toBe(100);
  });

  it('Duas recuperações para uma falta — apenas 1 conta (limitado)', () => {
    const sequences = [
      makeSequence([date(2026, 1, 1)], 'g1', 'm1', 't1'),
    ];
    const result = computeEnergy(sequences, 2, 0, defaultConfig);
    expect(result.totalRecovery).toBe(2); // capped at 1 recovery
    expect(result.netLoss).toBe(0);
  });

  it('Recuperação cobre múltiplas faltas (uma por falta)', () => {
    const sequences = [
      makeSequence([date(2026, 1, 1), date(2026, 1, 2)], 'g1', 'm1', 't1'),
    ];
    // primaryLoss: 3, recurrence: 0.5, totalLoss: 3.5
    // 2 recoveries → 4 energy restored
    // netLoss: max(0, 3.5 - 4) = 0
    const result = computeEnergy(sequences, 2, 0, defaultConfig);
    expect(result.totalRecovery).toBe(4);
    expect(result.netLoss).toBe(0);
    expect(result.finalEnergy).toBe(100);
  });

  // --- Escalada ---

  it('Escalada pode ultrapassar energia inicial', () => {
    const result = computeEnergy([], 0, 5, defaultConfig);
    expect(result.finalEnergy).toBe(105);
    expect(result.escaladaPoints).toBe(5);
  });

  it('Escalada compensa faltas e ultrapassa', () => {
    const sequences = [
      makeSequence([date(2026, 1, 1)], 'g1', 'm1', 't1'),
    ];
    // primaryLoss: 1, recurrence: 0.5, totalLoss: 1.5, netLoss: 1.5
    // finalEnergy: 100 - 1.5 + 10 = 108.5
    const result = computeEnergy(sequences, 0, 10, defaultConfig);
    expect(result.finalEnergy).toBe(108.5);
  });

  // --- Edge Cases ---

  it('Many consecutive absences (n=7) → penalty 127', () => {
    const dates = Array.from({ length: 7 }, (_, i) => date(2026, 1, 1 + i));
    const sequences = [makeSequence(dates, 'g1', 'm1', 't1')];
    const result = computeEnergy(sequences, 0, 0, defaultConfig);
    expect(result.primaryLoss).toBe(127); // 2^7 - 1
    expect(result.finalEnergy).toBe(-27.5); // 100 - 127 - 0.5 = -27.5
  });

  it('Multiple templates each with sequences', () => {
    const sequences = [
      makeSequence([date(2026, 1, 1)], 'g1', 'm1', 'bed'),
      makeSequence([date(2026, 1, 2)], 'g1', 'm1', 'dishes'),
      makeSequence([date(2026, 1, 3)], 'g1', 'm1', 'trash'),
    ];
    const result = computeEnergy(sequences, 0, 0, defaultConfig);
    // primaryLoss: 1+1+1 = 3
    // recurrence: k=3 → 3, weight 0.5 → 1.5
    expect(result.primaryLoss).toBe(3);
    expect(result.recurrencePenalty).toBe(1.5);
    expect(result.sequenceCount).toBe(3);
  });

  it('Custom recurrence weight', () => {
    const sequences = [
      makeSequence([date(2026, 1, 1)], 'g1', 'm1', 't1'),
      makeSequence([date(2026, 1, 3)], 'g1', 'm1', 't1'),
    ];
    const config: EnergyConfig = { ...defaultConfig, recurrenceWeight: 1.0 };
    const result = computeEnergy(sequences, 0, 0, config);
    // primaryLoss: 1+1=2, recurrence: 2*1.0 = 2
    expect(result.recurrencePenalty).toBe(2);
    expect(result.totalLoss).toBe(4);
  });

  it('Custom recovery value', () => {
    const sequences = [
      makeSequence([date(2026, 1, 1)], 'g1', 'm1', 't1'),
    ];
    const config: EnergyConfig = { ...defaultConfig, recoveryValue: 3 };
    const result = computeEnergy(sequences, 1, 0, config);
    expect(result.totalRecovery).toBe(3);
    expect(result.netLoss).toBe(0); // 1.5 loss offset by 3 recovery
  });
});

// ============================================================================
// getQualitativeState
// ============================================================================

describe('getQualitativeState', () => {
  it('>100 → exceptional', () => {
    expect(getQualitativeState(105, 100).state).toBe('exceptional');
  });

  it('90-100 → excellent', () => {
    expect(getQualitativeState(95, 100).state).toBe('excellent');
    expect(getQualitativeState(90, 100).state).toBe('excellent');
  });

  it('70-89 → good', () => {
    expect(getQualitativeState(80, 100).state).toBe('good');
    expect(getQualitativeState(70, 100).state).toBe('good');
  });

  it('50-69 → needs_attention', () => {
    expect(getQualitativeState(60, 100).state).toBe('needs_attention');
  });

  it('30-49 → at_risk', () => {
    expect(getQualitativeState(40, 100).state).toBe('at_risk');
  });

  it('<30 → critical', () => {
    expect(getQualitativeState(20, 100).state).toBe('critical');
  });

  it('negative energy → critical', () => {
    const state = getQualitativeState(-10, 100);
    expect(state.state).toBe('critical');
  });

  it('exactly 100 → excellent', () => {
    expect(getQualitativeState(100, 100).state).toBe('excellent');
  });
});

// ============================================================================
// getEnergyPercentage
// ============================================================================

describe('getEnergyPercentage', () => {
  it('100 out of 100 → 100%', () => {
    expect(getEnergyPercentage(100, 100)).toBe(100);
  });

  it('75 out of 100 → 75%', () => {
    expect(getEnergyPercentage(75, 100)).toBe(75);
  });

  it('105 out of 100 → 105% (escalada)', () => {
    expect(getEnergyPercentage(105, 100)).toBe(105);
  });
});

// ============================================================================
// Reincidência: a curva tem de continuar limitada
//
// Estes testes existem por causa de um bug real: a reincidência era 2^k − 1,
// com k = número de sequências de falta. Como cada falta isolada abre uma
// sequência nova, k crescia com a QUANTIDADE de faltas, e o castigo dobrava
// a cada uma. Uma família chegou a k=17 em nove dias — energia de −65478%.
//
// Se alguém tornar este termo exponencial de novo, estes testes quebram.
// ============================================================================

describe('recurrencePenalty — continua proporcional em k alto', () => {
  const isolated = (k: number) =>
    Array.from({ length: k }, (_, i) =>
      makeSequence([date(2026, 1, 1 + i * 2)], 'g1', 'm1', `t${i}`)
    );

  it('k=10 custa 5, não 511.5', () => {
    const r = computeEnergy(isolated(10), 0, 0, defaultConfig);
    expect(r.recurrencePenalty).toBe(5);
    expect(r.finalEnergy).toBe(85);
  });

  it('k=17 — o caso real — deixa a energia numa faixa utilizável', () => {
    const r = computeEnergy(isolated(17), 0, 0, defaultConfig);
    expect(r.recurrencePenalty).toBe(8.5);
    expect(getEnergyPercentage(r.finalEnergy, 100)).toBe(75);
  });

  it('cada sequência a mais custa sempre o mesmo — nunca dobra', () => {
    const steps = [8, 9, 10, 11, 12].map(
      (k) => computeEnergy(isolated(k), 0, 0, defaultConfig).recurrencePenalty
    );
    const deltas = steps.slice(1).map((v, i) => v - steps[i]!);
    expect(deltas).toEqual([0.5, 0.5, 0.5, 0.5]);
  });

  it('a energia nunca cai a um absurdo só por faltas isoladas', () => {
    const r = computeEnergy(isolated(30), 0, 0, defaultConfig);
    // 30 faltas isoladas: 30 de perda primária + 15 de reincidência.
    expect(r.finalEnergy).toBe(55);
  });

  it('faltas SEGUIDAS continuam pesando exponencialmente — a regra que importa', () => {
    const streak = [makeSequence(
      Array.from({ length: 5 }, (_, i) => date(2026, 1, 1 + i)), 'g1', 'm1', 't1'
    )];
    const scattered = isolated(5);
    const s5 = computeEnergy(streak, 0, 0, defaultConfig);
    const i5 = computeEnergy(scattered, 0, 0, defaultConfig);
    // Mesmas 5 faltas: seguidas custam 31.5, espalhadas custam 7.5.
    expect(s5.totalLoss).toBe(31.5);
    expect(i5.totalLoss).toBe(7.5);
    expect(s5.totalLoss).toBeGreaterThan(i5.totalLoss);
  });
});

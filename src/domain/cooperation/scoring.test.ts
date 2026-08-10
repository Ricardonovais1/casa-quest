// ============================================================
// Casa Quest — Domain: Cooperation Scoring Tests
// ============================================================

import { computeCooperationScore, getCooperationLevel } from './scoring';
import type { CooperationEvent } from './types';

function makeEvent(
  scoreDelta: number,
  eventType: CooperationEvent['eventType'] = 'auxilio',
  id = 'e1',
  guardianId = 'g1',
  missionId = 'm1'
): CooperationEvent {
  return {
    id,
    guardianId,
    missionId,
    eventType,
    scoreDelta,
    sourceId: null,
    metadata: {},
    createdBy: null,
    createdAt: new Date(),
  };
}

describe('computeCooperationScore', () => {
  it('empty events → 0', () => {
    expect(computeCooperationScore([])).toBe(0);
  });

  it('single auxilio → +1', () => {
    expect(computeCooperationScore([makeEvent(1)])).toBe(1);
  });

  it('three auxilios → +3', () => {
    const events = [makeEvent(1), makeEvent(1), makeEvent(1)];
    expect(computeCooperationScore(events)).toBe(3);
  });

  it('collective action → +2 per participant', () => {
    expect(computeCooperationScore([makeEvent(2, 'collective_action')])).toBe(2);
  });

  it('mixed events sum correctly', () => {
    const events = [
      makeEvent(1, 'auxilio'),
      makeEvent(2, 'collective_action'),
      makeEvent(1, 'auxilio'),
      makeEvent(-3, 'manual_adjustment'),
    ];
    expect(computeCooperationScore(events)).toBe(1);
  });

  it('negative manual adjustment reduces score', () => {
    const events = [makeEvent(5), makeEvent(-4, 'manual_adjustment')];
    expect(computeCooperationScore(events)).toBe(1);
  });
});

describe('getCooperationLevel', () => {
  it('score 0 → Individual', () => {
    expect(getCooperationLevel(0).level).toBe('Individual');
  });

  it('score 1 → Iniciante', () => {
    expect(getCooperationLevel(1).level).toBe('Iniciante');
  });

  it('score 5 → Bom', () => {
    expect(getCooperationLevel(5).level).toBe('Bom');
  });

  it('score 10 → Excelente', () => {
    expect(getCooperationLevel(10).level).toBe('Excelente');
  });

  it('score 20 → Lendário', () => {
    expect(getCooperationLevel(20).level).toBe('Lendário');
  });

  it('score 100 → Lendário', () => {
    expect(getCooperationLevel(100).level).toBe('Lendário');
  });

  it('negative score → Individual', () => {
    expect(getCooperationLevel(-5).level).toBe('Individual');
  });
});

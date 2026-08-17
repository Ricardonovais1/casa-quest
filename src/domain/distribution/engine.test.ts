// ============================================================
// Casa Quest — Domain: Distribution Engine Tests
// ============================================================

import { distribute } from './engine';
import type { DistributionAction, DistributionGuardian } from './engine';

function action(id: string, points: number): DistributionAction {
  return { id, name: id, points };
}

function guardian(id: string): DistributionGuardian {
  return { id, name: id };
}

/** The 12 collaborative actions from the default catalog (5× +1, 7× +2 = 19 pts). */
function colaboracaoCatalog(): DistributionAction[] {
  return [
    action('colocar-louca', 1),
    action('tirar-louca', 1),
    action('colocar-mesa', 1),
    action('tirar-mesa', 1),
    action('alimentar-pet', 1),
    action('recolher-lixo', 2),
    action('abastecer-filtro', 2),
    action('encher-garrafas', 2),
    action('higiene-pet', 2),
    action('organizar-banheiro', 2),
    action('organizar-cozinha', 2),
    action('varrer-casa', 2),
  ];
}

const threeGuardians = [guardian('rosa'), guardian('lira'), guardian('aurora')];

describe('distribute', () => {
  it('assigns every action exactly once', () => {
    const result = distribute(colaboracaoCatalog(), threeGuardians, 0);
    const assignedIds = result.assignments.map((a) => a.actionTemplateId).sort();
    const expectedIds = colaboracaoCatalog().map((a) => a.id).sort();
    expect(assignedIds).toEqual(expectedIds);
  });

  it('balances total points equânime (not equal, but small spread)', () => {
    const result = distribute(colaboracaoCatalog(), threeGuardians, 0);
    const totals = result.perGuardian.map((g) => g.totalPoints);
    const spread = Math.max(...totals) - Math.min(...totals);
    // 19 points across 3 guardians → ideal ~6.3 each; greedy keeps spread ≤ 2
    expect(spread).toBeLessThanOrEqual(2);
    // Each guardian gets at least one action
    expect(result.perGuardian.every((g) => g.count > 0)).toBe(true);
  });

  it('is deterministic for the same seed', () => {
    const a = distribute(colaboracaoCatalog(), threeGuardians, 5);
    const b = distribute(colaboracaoCatalog(), threeGuardians, 5);
    expect(a.assignments).toEqual(b.assignments);
  });

  it('rotates between different seeds', () => {
    const a = distribute(colaboracaoCatalog(), threeGuardians, 0);
    const b = distribute(colaboracaoCatalog(), threeGuardians, 1);
    expect(a.assignments).not.toEqual(b.assignments);
  });

  it('handles zero guardians gracefully', () => {
    const result = distribute(colaboracaoCatalog(), [], 0);
    expect(result.assignments).toEqual([]);
    expect(result.perGuardian).toEqual([]);
  });

  it('handles zero actions gracefully', () => {
    const result = distribute([], threeGuardians, 0);
    expect(result.assignments).toEqual([]);
    expect(result.perGuardian).toHaveLength(3);
  });

  it('handles more guardians than actions', () => {
    const result = distribute(
      [action('a', 2), action('b', 1)],
      [guardian('x'), guardian('y'), guardian('z')],
      0
    );
    expect(result.assignments).toHaveLength(2);
    const withActions = result.perGuardian.filter((g) => g.count > 0);
    expect(withActions).toHaveLength(2);
  });
});

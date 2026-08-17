// ============================================================
// Casa Quest — Domain: Distribution Engine
// Distributes collaborative actions among guardians in an
// "equânime" (balanced, not equal) way, based on points.
// Pure functions. ZERO dependencies. 100% testable.
// ============================================================

export interface DistributionAction {
  id: string;
  name: string;
  points: number;
}

export interface DistributionGuardian {
  id: string;
  name: string;
}

export interface Assignment {
  actionTemplateId: string;
  guardianId: string;
}

export interface GuardianLoad {
  guardianId: string;
  totalPoints: number;
  count: number;
}

export interface DistributionResult {
  assignments: Assignment[];
  perGuardian: GuardianLoad[];
}

/**
 * Distribute actions among guardians balancing total points.
 *
 * Strategy (greedy "heaviest first → lightest guardian"):
 *   1. Sort actions by points descending (points encode load: daily +1,
 *      2–3×/week +2, etc.).
 *   2. Rotate the guardian list by `seed` so each period starts with a
 *      different guardian (forces rotation between periods).
 *   3. Assign each action to the guardian with the lowest current total,
 *      tie-breaking by the rotated order.
 *
 * @param actions - Collaborative actions to distribute
 * @param guardians - Eligible guardians (active, non-Mor)
 * @param seed - Rotation seed (e.g. month ordinal of valid_from)
 */
export function distribute(
  actions: DistributionAction[],
  guardians: DistributionGuardian[],
  seed: number
): DistributionResult {
  const perGuardian: GuardianLoad[] = guardians.map((g) => ({
    guardianId: g.id,
    totalPoints: 0,
    count: 0,
  }));

  if (guardians.length === 0 || actions.length === 0) {
    return { assignments: [], perGuardian };
  }

  const sorted = [...actions].sort((a, b) => b.points - a.points);

  // Rotate so different seeds yield different distributions
  const offset = ((seed % guardians.length) + guardians.length) % guardians.length;
  const order = [...guardians.slice(offset), ...guardians.slice(0, offset)];

  const totals = new Map<string, number>(order.map((g) => [g.id, 0]));
  const assignments: Assignment[] = [];

  for (const action of sorted) {
    // Pick the guardian with the lowest current total (tie → first in order)
    let best = order[0]!;
    for (const g of order) {
      if ((totals.get(g.id) ?? 0) < (totals.get(best.id) ?? 0)) {
        best = g;
      }
    }
    assignments.push({ actionTemplateId: action.id, guardianId: best.id });
    totals.set(best.id, (totals.get(best.id) ?? 0) + action.points);
  }

  for (const g of perGuardian) {
    g.totalPoints = totals.get(g.guardianId) ?? 0;
    g.count = assignments.filter((a) => a.guardianId === g.guardianId).length;
  }

  return { assignments, perGuardian };
}

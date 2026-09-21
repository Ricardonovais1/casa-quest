// ============================================================
// Casa Quest — Domain: Revisão da distribuição
//
// A rodada é sorteada uma vez por período e o catálogo continua mudando
// depois: entra uma atividade nova (fica sem ninguém até o próximo
// sorteio), entra uma repetida com outro nome (e duas pessoas acabam com
// o mesmo trabalho, ou uma faz o mesmo trabalho duas vezes). Aqui a
// rodada vigente é conferida e sai uma lista de ajustes pequenos —
// trocar, atribuir, fundir — que não obrigam a sortear tudo de novo.
//
// Puro, sem I/O.
// ============================================================

export interface ReviewTask {
  id: string;
  name: string;
  /** 'habitos' (de todos) ou 'cooperacao' (de quem está com ela). */
  category: string;
  points: number;
}

export interface ReviewGuardian {
  id: string;
  name: string;
}

export interface ReviewAssignment {
  templateId: string;
  guardianId: string;
}

export interface ReviewPair {
  a: string;
  b: string;
  kind: 'same' | 'related';
}

export type MergeReason =
  /** Uma está sem ninguém e a gêmea já está no dia de alguém (ou as duas sem ninguém). */
  | 'unassigned-twin'
  /** Uma é hábito: quem está com a de colaboração faz o mesmo trabalho duas vezes. */
  | 'habit-twin'
  /** As duas de colaboração com a mesma pessoa. */
  | 'same-guardian'
  /** As duas de colaboração, cada uma com uma pessoa. */
  | 'two-guardians';

export type ReviewSuggestion =
  | {
      kind: 'swap';
      guardianId: string;
      /** A repetida que a pessoa deixa. */
      giveId: string;
      /** A que estava sem ninguém e passa a ser dela. */
      takeId: string;
      /** A tarefa igual à que ela deixa. */
      twinId: string;
      loadBefore: number;
      loadAfter: number;
    }
  | {
      kind: 'assign';
      guardianId: string;
      takeId: string;
      loadBefore: number;
      loadAfter: number;
    }
  | {
      kind: 'merge';
      /** Sugerida para ficar: a que já está no dia de alguém. */
      keepId: string;
      mergeId: string;
      reason: MergeReason;
      /** Quem é afetado: quem faz a repetida, ou quem já está com a gêmea. */
      guardianIds: string[];
    };

export interface DistributionReview {
  /** Atividades de colaboração sem ninguém nesta rodada. */
  unassigned: string[];
  /** Pontos de colaboração de cada guardião, como a rodada está agora. */
  loads: Record<string, number>;
  /** Trocas e atribuições primeiro, fusões depois. */
  suggestions: ReviewSuggestion[];
}

const KIND_ORDER: Record<ReviewSuggestion['kind'], number> = { swap: 0, assign: 1, merge: 2 };

interface Repeat {
  pair: ReviewPair;
  reason: MergeReason;
  guardianIds: string[];
  /** As de colaboração do par, que o dono pode deixar numa troca. */
  giveable: { taskId: string; guardianId: string; twinId: string }[];
}

export function reviewDistribution(input: {
  tasks: ReviewTask[];
  guardians: ReviewGuardian[];
  assignments: ReviewAssignment[];
  pairs: ReviewPair[];
}): DistributionReview {
  const { tasks, guardians, assignments, pairs } = input;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const kidIds = new Set(guardians.map((g) => g.id));
  const isShared = (t: ReviewTask) => t.category === 'cooperacao';

  // Dono de cada atividade de colaboração — só se ainda é um guardião ativo.
  const owner = new Map<string, string>();
  for (const a of assignments) {
    const t = byId.get(a.templateId);
    if (t && isShared(t) && kidIds.has(a.guardianId)) owner.set(a.templateId, a.guardianId);
  }

  const holders = (t: ReviewTask): string[] => {
    if (!isShared(t)) return guardians.map((g) => g.id);
    const gid = owner.get(t.id);
    return gid ? [gid] : [];
  };

  const loads: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const g of guardians) {
    loads[g.id] = 0;
    counts[g.id] = 0;
  }
  for (const [tid, gid] of owner) {
    loads[gid]! += byId.get(tid)!.points;
    counts[gid]! += 1;
  }
  const currentLoads = { ...loads };

  const unassigned = tasks
    .filter((t) => isShared(t) && !owner.has(t.id))
    .sort((x, y) => y.points - x.points || x.name.localeCompare(y.name, 'pt-BR'));

  if (guardians.length === 0) {
    return { unassigned: unassigned.map((t) => t.id), loads: currentLoads, suggestions: [] };
  }

  // Só "iguais" contam aqui: tarefas apenas parecidas podem conviver na rodada.
  const twins = pairs.filter((p) => p.kind === 'same' && byId.has(p.a) && byId.has(p.b));
  const other = (p: ReviewPair, id: string) => (p.a === id ? p.b : p.a);
  const touches = (p: ReviewPair, id: string) => p.a === id || p.b === id;

  const suggestions: ReviewSuggestion[] = [];
  const settled = new Set<string>();
  const pairsDone = new Set<ReviewPair>();

  // 1. Sem ninguém, mas é a mesma de outra: atribuir faria alguém repetir o
  //    trabalho. O ajuste é fundir.
  for (const u of unassigned) {
    if (settled.has(u.id)) continue;
    const withHolder = twins.find((p) => touches(p, u.id) && holders(byId.get(other(p, u.id))!).length > 0);
    const bothEmpty = withHolder
      ? undefined
      : twins.find((p) => touches(p, u.id) && !settled.has(other(p, u.id)));
    const pair = withHolder ?? bothEmpty;
    if (!pair) continue;

    const twin = byId.get(other(pair, u.id))!;
    suggestions.push({
      kind: 'merge',
      keepId: twin.id,
      mergeId: u.id,
      reason: 'unassigned-twin',
      guardianIds: holders(twin),
    });
    settled.add(u.id);
    settled.add(twin.id);
    pairsDone.add(pair);
  }

  // 2. A mesma tarefa já no dia de alguém, duas vezes.
  const repeats: Repeat[] = [];
  for (const pair of twins) {
    if (pairsDone.has(pair)) continue;
    const ta = byId.get(pair.a)!;
    const tb = byId.get(pair.b)!;
    const ha = holders(ta);
    const hb = holders(tb);
    if (ha.length === 0 || hb.length === 0) continue;

    const both = ha.filter((g) => hb.includes(g));
    const reason: MergeReason =
      !isShared(ta) || !isShared(tb) ? 'habit-twin' : both.length > 0 ? 'same-guardian' : 'two-guardians';
    repeats.push({
      pair,
      reason,
      guardianIds: both.length > 0 ? both : [...new Set([...ha, ...hb])],
      giveable: [ta, tb]
        .filter(isShared)
        .map((t) => ({ taskId: t.id, guardianId: owner.get(t.id)!, twinId: other(pair, t.id) })),
    });
  }

  // 3. Troca: quem está com uma repetida deixa ela e pega a que está sem
  //    ninguém. A carga dessa pessoa quase não muda; a de ninguém mais muda.
  const usedRepeats = new Set<Repeat>();
  for (const u of unassigned) {
    if (settled.has(u.id)) continue;

    let best: { repeat: Repeat; give: Repeat['giveable'][number]; cost: number } | null = null;
    for (const repeat of repeats) {
      if (usedRepeats.has(repeat)) continue;
      for (const give of repeat.giveable) {
        const cost = Math.abs(byId.get(give.taskId)!.points - u.points);
        const heavier = best && loads[give.guardianId]! > loads[best.give.guardianId]!;
        if (!best || cost < best.cost || (cost === best.cost && heavier)) {
          best = { repeat, give, cost };
        }
      }
    }

    if (best) {
      const { give } = best;
      const before = loads[give.guardianId]!;
      const after = before - byId.get(give.taskId)!.points + u.points;
      loads[give.guardianId] = after;
      suggestions.push({
        kind: 'swap',
        guardianId: give.guardianId,
        giveId: give.taskId,
        takeId: u.id,
        twinId: give.twinId,
        loadBefore: before,
        loadAfter: after,
      });
      usedRepeats.add(best.repeat);
      settled.add(u.id);
      continue;
    }

    // 4. Nenhuma repetida para trocar: vai para quem está mais leve.
    const lightest = [...guardians].sort(
      (x, y) => loads[x.id]! - loads[y.id]! || counts[x.id]! - counts[y.id]!
    )[0]!;
    const before = loads[lightest.id]!;
    loads[lightest.id] = before + u.points;
    counts[lightest.id]! += 1;
    suggestions.push({
      kind: 'assign',
      guardianId: lightest.id,
      takeId: u.id,
      loadBefore: before,
      loadAfter: before + u.points,
    });
    settled.add(u.id);
  }

  // 5. Repetidas que não entraram numa troca: fundir. Fica a de maior
  //    alcance — o hábito, ou a que vale mais pontos.
  for (const repeat of repeats) {
    if (usedRepeats.has(repeat)) continue;
    const ta = byId.get(repeat.pair.a)!;
    const tb = byId.get(repeat.pair.b)!;
    const keepA = isShared(ta) !== isShared(tb) ? !isShared(ta) : ta.points >= tb.points;
    suggestions.push({
      kind: 'merge',
      keepId: keepA ? ta.id : tb.id,
      mergeId: keepA ? tb.id : ta.id,
      reason: repeat.reason,
      guardianIds: repeat.guardianIds,
    });
  }

  return {
    unassigned: unassigned.map((t) => t.id),
    loads: currentLoads,
    suggestions: suggestions.sort((x, y) => KIND_ORDER[x.kind] - KIND_ORDER[y.kind]),
  };
}

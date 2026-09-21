// ============================================================
// Casa Quest — Lib: pares de ações marcados como "não são iguais"
//
// DECISION (2026-09-15): fica no localStorage do aparelho, não no banco.
// Guardar no banco pediria uma migração nova com a 00010 ainda pendente;
// o custo de ficar no aparelho é pequeno — outro adulto, ou outro
// navegador, vê o par de novo e dispensa de novo.
//
// Só no cliente. Toda leitura e escrita tolera o storage bloqueado.
// ============================================================

const storageKey = (familyId: string) => `casaquest:acoes-diferentes:${familyId}`;

/** Chaves de par (ver `pairKey`) que alguém já disse que não são a mesma tarefa. */
export function readDismissedPairs(familyId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(storageKey(familyId));
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((k): k is string => typeof k === 'string') : []);
  } catch {
    return new Set();
  }
}

export function saveDismissedPairs(familyId: string, pairs: Set<string>): void {
  try {
    window.localStorage.setItem(storageKey(familyId), JSON.stringify([...pairs]));
  } catch {
    // Sem storage, o par volta a aparecer na próxima visita — só isso.
  }
}

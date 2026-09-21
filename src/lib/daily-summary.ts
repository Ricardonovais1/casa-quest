// ============================================================
// Casa Quest — Lib: Tipos do resumo do dia anterior
//
// Contrato entre /api/daily-summary e o pop-up que abre na primeira
// vez que alguém entra no app a cada dia.
// ============================================================

export interface DailySummaryGuardian {
  id: string;
  name: string;
  /** Ações concluídas ontem (inclui missões extras). */
  done: number;
  missed: number;
  /** Quantas ações o dia tinha, fora as canceladas. */
  scheduled: number;
  /** Saldo de pontos do dia: o que somou menos o que os tropeços tiraram. */
  points: number;
  /** Nomes das missões extras registradas ontem. */
  extras: string[];
  allDone: boolean;
  /** Energia atual na missão, em % da meta. null fora de uma missão. */
  energyPercent: number | null;
}

export interface DailySummary {
  /** Dia coberto pelo resumo (YYYY-MM-DD, no fuso da família). */
  date: string;
  familyName: string;
  mission: { id: string; name: string } | null;
  totals: { done: number; missed: number; extras: number };
  guardians: DailySummaryGuardian[];
  /** Frases prontas de conquista, para o topo do pop-up. */
  achievements: string[];
  /** Sem nenhum registro ontem, o pop-up não aparece. */
  hasActivity: boolean;
}

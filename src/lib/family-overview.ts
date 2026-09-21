// ============================================================
// Casa Quest — Lib: Tipos do retrato da família
//
// O contrato entre a rota /api/families/overview e a tela de Família.
// Fica num módulo próprio para o componente de cliente importar o tipo
// sem esbarrar no handler de rota.
// ============================================================

import type { GuardianEnergy } from './guardian-energy';

export interface OverviewAction {
  id: string;
  name: string;
  status: string;
  categoryEmoji: string;
  categoryLabel: string;
  /** "até 20:00" ou "dia todo"; para extras, a hora do registro. */
  whenLabel: string;
  isExtra: boolean;
}

export interface OverviewAssignment {
  id: string;
  name: string;
  points: number;
  frequency: string | null;
}

export interface OverviewGuardian {
  id: string;
  name: string;
  age: number | null;
  isActive: boolean;
  accessToken: string | null;
  today: {
    done: number;
    pending: number;
    awaiting: number;
    missed: number;
    actions: OverviewAction[];
  };
  assignments: OverviewAssignment[];
  energy: GuardianEnergy | null;
}

export interface FamilyOverview {
  mission: { id: string; name: string } | null;
  /** Fim do período da distribuição atual (YYYY-MM-DD). */
  periodUntil: string | null;
  guardians: OverviewGuardian[];
}

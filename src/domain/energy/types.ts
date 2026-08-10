// ============================================================
// Casa Quest — Domain: Energy Types
// Pure types for the energy-of-commitment system.
// Energy is NOT money. It's an abstract behavioral metric.
// ============================================================

/** Qualitative states shown to guardians instead of numbers/money */
export const EnergyQualitativeState = {
  EXCEPTIONAL: 'exceptional',     // > 100% (with escalada bonuses)
  EXCELLENT: 'excellent',         // 90-100%
  GOOD: 'good',                   // 70-89%
  NEEDS_ATTENTION: 'needs_attention', // 50-69%
  AT_RISK: 'at_risk',             // 30-49%
  CRITICAL: 'critical',           // < 30%
} as const;

export type EnergyQualitativeState =
  (typeof EnergyQualitativeState)[keyof typeof EnergyQualitativeState];

/** Event types for the immutable energy event log */
export const EnergyEventType = {
  INITIAL_ENERGY: 'initial_energy',
  MISS: 'miss',
  RECOVERY: 'recovery',
  AUXILIO: 'auxilio',
  ESCALADA: 'escalada',
  MANUAL_ADJUSTMENT: 'manual_adjustment',
} as const;

export type EnergyEventType =
  (typeof EnergyEventType)[keyof typeof EnergyEventType];

/** A single immutable energy event */
export interface EnergyEvent {
  readonly id: string;
  readonly guardianId: string;
  readonly missionId: string;
  readonly eventType: EnergyEventType;
  readonly amount: number;       // positive = gain, negative = loss
  readonly sourceId: string | null; // links to mission_action id or null for manual
  readonly metadata: Record<string, unknown>;
  readonly createdBy: string | null;
  readonly createdAt: Date;
}

/** An absence sequence — consecutive missed days for one action type */
export interface AbsenceSequence {
  readonly guardianId: string;
  readonly missionId: string;
  readonly actionTemplateId: string;
  readonly absenceDates: Date[];   // ordered, consecutive
  readonly length: number;
}

/** Configuration for energy computation */
export interface EnergyConfig {
  initialEnergy: number;          // default 100
  recurrenceWeight: number;       // default 0.5 — weight applied to recurrence penalty
  recoveryValue: number;          // default 2 — energy restored per recovery action
}

/** Result of a full energy computation */
export interface EnergyResult {
  primaryLoss: number;            // Sum of all sequence penalties
  recurrencePenalty: number;      // Penalty for having multiple distinct sequences
  totalLoss: number;              // primaryLoss + recurrencePenalty
  totalRecovery: number;          // Energy recovered via recovery actions
  netLoss: number;                // max(0, totalLoss - totalRecovery)
  escaladaPoints: number;         // Extra points from escalada actions
  finalEnergy: number;            // initialEnergy - netLoss + escaladaPoints
  sequences: AbsenceSequence[];   // All sequences found (for audit)
  sequenceCount: number;          // Number of distinct sequences
}

/** Qualitative state mapping */
export interface QualitativeStateInfo {
  state: EnergyQualitativeState;
  label: string;
  emoji: string;
  color: string;                  // Tailwind color class
}

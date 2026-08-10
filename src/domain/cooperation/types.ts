// ============================================================
// Casa Quest — Domain: Cooperation Types
// Cooperation is a SEPARATE dimension from energy.
// Auxilio gives cooperation, NOT energy.
// ============================================================

export const CooperationEventType = {
  AUXILIO: 'auxilio',
  COLLECTIVE_ACTION: 'collective_action',
  MANUAL_ADJUSTMENT: 'manual_adjustment',
} as const;

export type CooperationEventType =
  (typeof CooperationEventType)[keyof typeof CooperationEventType];

export interface CooperationEvent {
  readonly id: string;
  readonly guardianId: string;
  readonly missionId: string;
  readonly eventType: CooperationEventType;
  readonly scoreDelta: number;
  readonly sourceId: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdBy: string | null;
  readonly createdAt: Date;
}

/** Scoring rules */
export const COOPERATION_SCORES = {
  AUXILIO_GIVEN: 1,        // Helper gets +1 for helping
  COLLECTIVE_ACTION: 2,    // Each participant gets +2
  MANUAL_MIN: -10,
  MANUAL_MAX: 10,
} as const;

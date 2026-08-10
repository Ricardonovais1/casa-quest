// ============================================================
// Casa Quest — Domain: Quorum Calculator
// Determines how many confirmations are needed for an action.
// ============================================================

/** Supported quorum strategies */
export const QuorumType = {
  DYNAMIC: 'dynamic',
  FIXED: 'fixed',
} as const;

export type QuorumType = (typeof QuorumType)[keyof typeof QuorumType];

/** Configuration for quorum calculation */
export interface QuorumConfig {
  quorumType: QuorumType;
  quorumSmallFamily: number;   // default 1 (for families below threshold)
  quorumLargeFamily: number;   // default 2 (for families at/above threshold)
  quorumThreshold: number;     // default 3 (family size threshold)
  quorumFixed: number;          // used when quorumType = 'fixed'
}

/** Default quorum configuration */
export const DEFAULT_QUORUM_CONFIG: QuorumConfig = {
  quorumType: 'dynamic',
  quorumSmallFamily: 1,
  quorumLargeFamily: 2,
  quorumThreshold: 3,
  quorumFixed: 1,
};

/**
 * Calculate the required number of confirmations for an action.
 *
 * Dynamic rule:
 *   - Family with < threshold people → smallFamily confirmer
 *   - Family with >= threshold people → largeFamily confirmers
 *
 * Fixed rule:
 *   - Always use the fixed value
 *
 * @param config - Family quorum configuration
 * @param eligibleConfirmersCount - Number of guardians who CAN confirm
 *                                 (excludes the action owner, includes active guardians + Mor)
 * @returns Required number of confirmations (capped at eligibleConfirmersCount)
 */
export function calculateQuorum(
  config: QuorumConfig,
  eligibleConfirmersCount: number
): number {
  let required: number;

  if (config.quorumType === 'fixed') {
    required = config.quorumFixed;
  } else {
    // Dynamic: family size is eligible confirmers + 1 (the owner)
    const familySize = eligibleConfirmersCount + 1;
    required =
      familySize >= config.quorumThreshold
        ? config.quorumLargeFamily
        : config.quorumSmallFamily;
  }

  // Cap at the number of eligible confirmers
  return Math.min(required, Math.max(1, eligibleConfirmersCount));
}

/**
 * Check if the quorum has been met.
 *
 * @param confirmationsReceived - Number of confirmations already received
 * @param requiredQuorum - Required number (from calculateQuorum)
 * @returns true if quorum is met
 */
export function isQuorumMet(
  confirmationsReceived: number,
  requiredQuorum: number
): boolean {
  return confirmationsReceived >= requiredQuorum;
}

/**
 * Get eligible confirmers for an action.
 *
 * Rules:
 *   - Guardian can NEVER confirm their own action
 *   - Mor can always confirm any action
 *   - All other active guardians are eligible
 *
 * @param actionOwnerId - The guardian who performed the action
 * @param allGuardians - All guardians in the family
 * @returns Array of eligible confirmer guardian IDs
 */
export function getEligibleConfirmers(
  actionOwnerId: string,
  allGuardians: readonly { id: string; isActive: boolean; isMor: boolean }[]
): string[] {
  return allGuardians
    .filter(g => g.isActive && g.id !== actionOwnerId)
    .map(g => g.id);
}

/**
 * Determine if a specific guardian can confirm a specific action.
 *
 * @param confirmerId - The guardian trying to confirm
 * @param actionOwnerId - The guardian who performed the action
 * @param allowSelfConfirmation - Family setting (default false)
 * @returns true if this guardian is allowed to confirm
 */
export function canConfirm(
  confirmerId: string,
  actionOwnerId: string,
  allowSelfConfirmation: boolean = false
): boolean {
  if (confirmerId === actionOwnerId) {
    return allowSelfConfirmation;
  }
  return true; // Any other guardian can confirm
}

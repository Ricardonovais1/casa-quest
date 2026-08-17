// ============================================================
// Casa Quest — Lib: Constants
// Application-wide constants.
// ============================================================

/** App metadata */
export const APP_NAME = 'Casa Quest';
export const APP_SHORT_NAME = 'CasaQuest';
export const APP_DESCRIPTION =
  'Aplicativo familiar para desenvolver responsabilidade, constância e cooperação.';
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://app.casaquest.com';

/** Energy system */
export const DEFAULT_INITIAL_ENERGY = 100;
export const DEFAULT_RECOVERY_VALUE = 2;
export const DEFAULT_RECURRENCE_WEIGHT = 0.5;
export const DEFAULT_TOLERANCE_MINUTES = 30;

/** Mission */
export const DEFAULT_MISSION_DURATION_DAYS = 15;
export const MISSION_DURATION_OPTIONS = [7, 15, 30] as const;

/** Distribution rotation interval (months) */
export const ROTATION_INTERVAL_OPTIONS = [1, 2, 3] as const;

/** Confirmation */
export const CONFIRMATION_MODES = [
  'none',
  'one_peer',
] as const;

export const QUORUM_TYPES = ['dynamic', 'fixed'] as const;

/** Action categories */
export const ACTION_CATEGORIES = [
  'habitos',
  'cooperacao',
  'tropecos',
  'missoes',
  'gentilezas',
  'autoaperfeicoamento',
  'rendimento_escolar',
] as const;

export const ACTION_TYPES = ['basic', 'recovery', 'escalada'] as const;

/** Qualitative energy states — guardian-facing labels */
export const QUALITATIVE_STATES = {
  exceptional: { label: 'Excepcional', emoji: '🌟', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  excellent: { label: 'Compromisso Forte', emoji: '🟢', color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  good: { label: 'Atenção', emoji: '🟡', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  needs_attention: { label: 'Em Recuperação', emoji: '🟠', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  at_risk: { label: 'Precisa Melhorar', emoji: '🔴', color: 'text-red-500', bgColor: 'bg-red-100' },
  critical: { label: 'Precisa Melhorar', emoji: '🔴', color: 'text-red-700', bgColor: 'bg-red-200' },
} as const;

/** Cooperation levels */
export const COOPERATION_LEVELS = {
  legendary: { label: 'Lendário', emoji: '👑', minScore: 20 },
  excellent: { label: 'Excelente', emoji: '🤝', minScore: 10 },
  good: { label: 'Bom', emoji: '👍', minScore: 5 },
  beginner: { label: 'Iniciante', emoji: '🌱', minScore: 1 },
  individual: { label: 'Individual', emoji: '🧍', minScore: 0 },
} as const;

/** Escalada default categories */
export const DEFAULT_ESCALADA_CATEGORIES = [
  { name: 'Missões', basePoints: 2, bonusMultiplier: 1.5, maxPerMission: 10 },
  { name: 'Gentilezas', basePoints: 1, bonusMultiplier: 2.0, maxPerMission: 8 },
  { name: 'Autoaperfeiçoamento', basePoints: 2, bonusMultiplier: 1.2, maxPerMission: 12 },
  { name: 'Rendimento Escolar', basePoints: 3, bonusMultiplier: 1.0, maxPerMission: 15 },
] as const;

/** Reward tiers (default) */
export const DEFAULT_REWARD_TIERS = [
  { min: 90, max: 100, label: '100%', rewardPercent: 100 },
  { min: 70, max: 89, label: '80%', rewardPercent: 80 },
  { min: 50, max: 69, label: '60%', rewardPercent: 60 },
  { min: 30, max: 49, label: '40%', rewardPercent: 40 },
  { min: 0, max: 29, label: '20%', rewardPercent: 20 },
] as const;

/** Color scheme for action types */
export const ACTION_TYPE_COLORS = {
  basic: { border: 'border-blue-400', bg: 'bg-blue-50', text: 'text-blue-700' },
  recovery: { border: 'border-orange-400', bg: 'bg-orange-50', text: 'text-orange-700' },
  escalada: { border: 'border-purple-400', bg: 'bg-purple-50', text: 'text-purple-700' },
} as const;

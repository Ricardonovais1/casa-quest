// ============================================================
// Casa Quest — Lib: Validation Schemas (Zod)
// ============================================================

import { z } from 'zod';
import { ACTION_CATEGORIES, ACTION_TYPES, CONFIRMATION_MODES } from './constants';

// ============================================================================
// Family
// ============================================================================

export const createFamilySchema = z.object({
  name: z.string().min(1, 'Nome da família é obrigatório').max(100),
  timezone: z.string().default('America/Sao_Paulo'),
});

export const updateFamilySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  timezone: z.string().optional(),
  quorumType: z.enum(['dynamic', 'fixed']).optional(),
  quorumSmallFamily: z.number().int().min(1).max(10).optional(),
  quorumLargeFamily: z.number().int().min(1).max(10).optional(),
  quorumThreshold: z.number().int().min(2).max(20).optional(),
  quorumFixed: z.number().int().min(0).max(10).optional(),
  toleranceMinutes: z.number().int().min(0).max(480).optional(),
  recoveryEnabled: z.boolean().optional(),
  recoveryValue: z.number().int().min(1).max(10).optional(),
  auxilioEnabled: z.boolean().optional(),
  escaladaEnabled: z.boolean().optional(),
  missionDurationDays: z.number().int().min(7).max(30).optional(),
  rotationIntervalMonths: z.number().int().min(1).max(3).optional(),
});

export type CreateFamilyInput = z.infer<typeof createFamilySchema>;
export type UpdateFamilyInput = z.infer<typeof updateFamilySchema>;

// ============================================================================
// Guardian
// ============================================================================

export const createGuardianSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  age: z.number().int().min(0).max(120).optional(),
  isMor: z.boolean().default(false),
  email: z.email().optional(),
});

export const updateGuardianSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  age: z.number().int().min(0).max(120).optional(),
  avatarUrl: z.url().optional(),
  isActive: z.boolean().optional(),
});

export type CreateGuardianInput = z.infer<typeof createGuardianSchema>;
export type UpdateGuardianInput = z.infer<typeof updateGuardianSchema>;

// ============================================================================
// Action Template
// ============================================================================

export const createActionTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  category: z.enum(ACTION_CATEGORIES),
  actionType: z.enum(ACTION_TYPES).default('basic'),
  points: z.number().int().optional(),
  defaultDueTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM').default('20:00'),
  defaultDuration: z.number().int().positive().optional(),
  frequency: z.string().default('daily'),
  isCollective: z.boolean().default(false),
  confirmationMode: z.enum(CONFIRMATION_MODES).default('none'),
  confirmationQuorumOverride: z.number().int().min(1).optional(),
  toleranceMinutesOverride: z.number().int().min(0).max(480).optional(),
  recoveryValueOverride: z.number().int().min(1).max(10).optional(),
  escaladaCategory: z.string().optional(),
  escaladaBasePoints: z.number().int().min(0).optional(),
  escaladaBonusMultiplier: z.number().min(0).optional(),
  escaladaMaxPerMission: z.number().int().min(1).optional(),
});

export const updateActionTemplateSchema = createActionTemplateSchema.partial();

export type CreateActionTemplateInput = z.infer<typeof createActionTemplateSchema>;
export type UpdateActionTemplateInput = z.infer<typeof updateActionTemplateSchema>;

// ============================================================================
// Mission
// ============================================================================

export const createMissionSchema = z.object({
  name: z.string().min(1).max(200),
  startAt: z.iso.datetime({ message: 'Data de início inválida' }),
  endAt: z.iso.datetime({ message: 'Data de fim inválida' }),
  targetRewardAmount: z.number().positive('Valor da mesada deve ser positivo'),
});

export type CreateMissionInput = z.infer<typeof createMissionSchema>;

// ============================================================================
// Action Marking & Confirmation
// ============================================================================

export const markActionSchema = z.object({
  notes: z.string().max(500).optional(),
});

export const confirmActionSchema = z.object({
  decision: z.enum(['confirmed', 'rejected']),
  justification: z.string().max(500).optional(),
});

export const escalateActionSchema = z.object({
  escaladaCategory: z.string().min(1),
  points: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
});

export type MarkActionInput = z.infer<typeof markActionSchema>;
export type ConfirmActionInput = z.infer<typeof confirmActionSchema>;
export type EscalateActionInput = z.infer<typeof escalateActionSchema>;

// ============================================================================
// Onboarding
// ============================================================================

export const onboardingSchema = z.object({
  familyName: z.string().min(1, 'Nome da família é obrigatório').max(100),
  participantCount: z.number().int().min(2).max(20),
  morName: z.string().min(1).max(100),
  guardianNames: z.array(z.string().min(1).max(100)).min(1).max(19),
  quorumType: z.enum(['dynamic', 'fixed_1', 'fixed_2', 'fixed_n']).default('dynamic'),
  quorumFixed: z.number().int().min(1).optional(),
  toleranceMinutes: z.number().int().default(30),
  missionDurationDays: z.number().int().default(15),
  recoveryEnabled: z.boolean().default(true),
  auxilioEnabled: z.boolean().default(true),
  escaladaEnabled: z.boolean().default(false),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

// ============================================================
// Casa Quest — Lib: Default Action Catalog
// Pre-registered actions (Hábitos, Colaboração, Tropeços, Missões)
// plus category metadata and helpers to seed them into a family.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

/** Action category → action_type mapping (action_type is derived). */
export const CATEGORY_TO_ACTION_TYPE: Record<string, string> = {
  habitos: 'basic',
  cooperacao: 'basic',
  tropecos: 'basic',
  missoes: 'recovery',
  gentilezas: 'escalada',
  autoaperfeicoamento: 'escalada',
  rendimento_escolar: 'escalada',
};

/** Visible categories, in display order. */
export const ACTION_CATEGORY_META = [
  { value: 'habitos', label: 'Hábitos', emoji: '🛏️', actionType: 'basic' },
  { value: 'cooperacao', label: 'Colaboração', emoji: '🤝', actionType: 'basic' },
  { value: 'tropecos', label: 'Tropeços', emoji: '⚠️', actionType: 'basic' },
  { value: 'missoes', label: 'Missões', emoji: '🏆', actionType: 'recovery' },
  { value: 'gentilezas', label: 'Gentilezas', emoji: '💝', actionType: 'escalada' },
  { value: 'autoaperfeicoamento', label: 'Autoaperfeiçoamento', emoji: '📚', actionType: 'escalada' },
] as const;

export function categoryMeta(value: string) {
  return ACTION_CATEGORY_META.find((c) => c.value === value);
}

/** Common frequency options. */
export const FREQUENCY_OPTIONS = [
  'diária',
  '1×/semana',
  '2×/semana',
  '3×/semana',
  'sob demanda',
  'por ocorrência',
] as const;

export interface DefaultActionSeed {
  name: string;
  category: string;
  points: number;
  frequency: string;
  description?: string;
}

/**
 * The pre-registered catalog. Points follow the household plan:
 *   Hábitos +1/+2 · Colaboração +1/+2 · Tropeços −1 · Missões +3..+7
 */
export const DEFAULT_ACTION_CATALOG: DefaultActionSeed[] = [
  // ── Hábitos (individual) ─────────────────────────────────────
  { name: 'Arrumar a cama', category: 'habitos', points: 1, frequency: 'diária' },
  { name: 'Arrumar armário', category: 'habitos', points: 2, frequency: '1×/semana' },

  // ── Colaboração (coletivo) ───────────────────────────────────
  { name: 'Colocar louça', category: 'cooperacao', points: 1, frequency: 'diária' },
  { name: 'Tirar louça', category: 'cooperacao', points: 1, frequency: 'diária' },
  { name: 'Colocar a mesa', category: 'cooperacao', points: 1, frequency: 'diária' },
  { name: 'Tirar a mesa', category: 'cooperacao', points: 1, frequency: 'diária' },
  { name: 'Recolher o lixo', category: 'cooperacao', points: 2, frequency: '3×/semana' },
  { name: 'Abastecer filtro de água', category: 'cooperacao', points: 2, frequency: '3×/semana' },
  { name: 'Encher garrafas de água', category: 'cooperacao', points: 2, frequency: '3×/semana' },
  { name: 'Alimentar o pet', category: 'cooperacao', points: 1, frequency: 'diária' },
  { name: 'Higiene do pet', category: 'cooperacao', points: 2, frequency: '2×/semana' },
  { name: 'Organizar o banheiro', category: 'cooperacao', points: 2, frequency: '2×/semana' },
  { name: 'Organizar cozinha', category: 'cooperacao', points: 2, frequency: '2×/semana' },
  { name: 'Varrer a casa', category: 'cooperacao', points: 2, frequency: '2×/semana' },

  // ── Tropeços (tiram ponto) ───────────────────────────────────
  { name: 'Não trazer copos e pratos do quarto', category: 'tropecos', points: -1, frequency: 'por ocorrência' },
  { name: 'Não pendurar toalha após banho', category: 'tropecos', points: -1, frequency: 'por ocorrência' },
  { name: 'Não colocar roupas sujas no cesto', category: 'tropecos', points: -1, frequency: 'por ocorrência' },
  { name: 'Tomar banho depois do horário estipulado', category: 'tropecos', points: -1, frequency: 'por ocorrência' },
  { name: 'Não tomar banho', category: 'tropecos', points: -1, frequency: 'por ocorrência' },
  { name: 'Não escovar os dentes', category: 'tropecos', points: -1, frequency: 'por ocorrência' },
  { name: 'Não guardar', category: 'tropecos', points: -1, frequency: 'por ocorrência', description: 'O que deveria guardar' },
  { name: 'Não guardar utensílios e alimentos que usou', category: 'tropecos', points: -1, frequency: 'por ocorrência' },

  // ── Missões (recuperação) ────────────────────────────────────
  { name: 'Cuidar do jardim', category: 'missoes', points: 5, frequency: 'sob demanda', description: 'esforço médio' },
  { name: 'Lavar o carro', category: 'missoes', points: 7, frequency: 'sob demanda', description: 'esforço alto' },
  { name: 'Lavar roupa', category: 'missoes', points: 5, frequency: 'sob demanda', description: 'esforço médio' },
  { name: 'Limpar banheiro', category: 'missoes', points: 7, frequency: 'sob demanda', description: 'esforço alto' },
  { name: 'Limpar móveis', category: 'missoes', points: 4, frequency: 'sob demanda', description: 'esforço médio' },
  { name: 'Ajudar ou fazer uma refeição', category: 'missoes', points: 5, frequency: 'sob demanda', description: 'esforço médio/alto' },
  { name: 'Fazer pequenas compras', category: 'missoes', points: 3, frequency: 'sob demanda', description: 'esforço variável' },
];

/** Build an `action_templates` insert row from a seed. */
export function buildActionInsert(seed: DefaultActionSeed) {
  return {
    name: seed.name,
    description: seed.description ?? null,
    category: seed.category,
    action_type: CATEGORY_TO_ACTION_TYPE[seed.category] ?? 'basic',
    points: seed.points,
    frequency: seed.frequency,
    default_due_time: '20:00',
    confirmation_mode: 'none',
    is_active: true,
  };
}

/** Insert the full default catalog into a family. */
export async function seedDefaultActions(
  supabase: SupabaseClient,
  familyId: string
) {
  const rows = DEFAULT_ACTION_CATALOG.map((seed) => ({
    ...buildActionInsert(seed),
    family_id: familyId,
  }));

  await supabase.from('action_templates').insert(rows);
}

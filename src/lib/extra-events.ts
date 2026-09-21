// ============================================================
// Casa Quest — Lib: Eventos extras (tropeço · missão extra)
//
// Fora do ciclo diário existem dois tipos de registro, e só dois:
//
//   ⚠️ Tropeço      — algo que deixou de fazer. Vira falta.
//                     Só adulto da casa registra.
//   🏆 Missão extra — fez além do combinado. Devolve ou soma energia.
//                     O adulto registra, e o guardião também pode
//                     registrar a própria pelo link dele.
//
// "Missão extra" e "escalada" eram dois botões no formulário para a
// mesma ideia — "fiz algo a mais". Viraram um conceito só: o efeito no
// banco (compensar uma falta ou somar energia extra) sai da categoria
// da ação, não de uma escolha de quem registra.
//
// A parte pura é testada; o I/O vive em `registerExtraEvent`.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

/** O que o registro faz com a energia. Derivado da categoria da ação. */
export type ExtraEffect = 'tropeco' | 'recovery' | 'escalada';

/** O que o formulário oferece. */
export type ExtraKind = 'tropeco' | 'extra';

export const TROPECO_CATEGORIES = ['tropecos'] as const;
/** Compensam uma falta: devolvem a energia perdida. */
export const RECOVERY_CATEGORIES = ['missoes'] as const;
/** Vão além do combinado: somam energia, podendo passar de 100. */
export const ESCALADA_CATEGORIES = [
  'gentilezas',
  'autoaperfeicoamento',
  'rendimento_escolar',
] as const;

/** Tudo que entra em "missão extra" — o conceito unificado. */
export const EXTRA_EVENT_CATEGORIES: string[] = [
  ...RECOVERY_CATEGORIES,
  ...ESCALADA_CATEGORIES,
];

/** Categorias que nunca são geradas pelo dia: alguém registra quando acontece. */
export const ALL_EXTRA_CATEGORIES: string[] = [
  ...TROPECO_CATEGORIES,
  ...EXTRA_EVENT_CATEGORIES,
];

export const EXTRA_KIND_META: {
  value: ExtraKind;
  label: string;
  emoji: string;
  help: string;
  /** Só adulto da casa pode registrar? */
  adultsOnly: boolean;
}[] = [
  {
    value: 'tropeco',
    label: 'Tropeço',
    emoji: '⚠️',
    help: 'Algo que deixou de fazer. Vira uma falta na energia. Só os adultos da casa registram.',
    adultsOnly: true,
  },
  {
    value: 'extra',
    label: 'Missão extra',
    emoji: '🏆',
    help: 'Fez além do combinado — uma tarefa grande, uma gentileza, estudo. Compensa faltas ou soma energia extra.',
    adultsOnly: false,
  },
];

/** Efeito de uma categoria de ação. null quando ela não é um evento extra. */
export function effectOfCategory(category: string): ExtraEffect | null {
  if ((TROPECO_CATEGORIES as readonly string[]).includes(category)) return 'tropeco';
  if ((RECOVERY_CATEGORIES as readonly string[]).includes(category)) return 'recovery';
  if ((ESCALADA_CATEGORIES as readonly string[]).includes(category)) return 'escalada';
  return null;
}

/** Em que aba do formulário a categoria aparece. */
export function kindOfCategory(category: string): ExtraKind | null {
  const effect = effectOfCategory(category);
  if (!effect) return null;
  return effect === 'tropeco' ? 'tropeco' : 'extra';
}

export function categoriesForKind(kind: ExtraKind): string[] {
  return kind === 'tropeco' ? [...TROPECO_CATEGORIES] : EXTRA_EVENT_CATEGORIES;
}

/**
 * Aceita o vocabulário novo e o antigo. As telas mandavam `recovery` e
 * `escalada` como tipos separados; os dois viraram `extra`.
 */
export function normalizeKind(raw: unknown): ExtraKind | null {
  if (raw === 'tropeco') return 'tropeco';
  if (raw === 'extra' || raw === 'recovery' || raw === 'escalada') return 'extra';
  return null;
}

export interface ExtraTemplate {
  id: string;
  name: string;
  category: string;
  points: number | null;
  escalada_base_points?: number | null;
}

/** Energia que uma escalada soma: os pontos da ação, ou o padrão dela. */
export function escaladaPointsOf(template: ExtraTemplate): number {
  const points = template.points ?? 0;
  if (points > 0) return points;
  return template.escalada_base_points || 2;
}

export interface ExtraRowInput {
  missionId: string;
  guardianId: string;
  template: ExtraTemplate;
  effect: ExtraEffect;
  /** Falta que esta missão extra compensa, quando há alguma em aberto. */
  recoversActionId?: string | null;
  /** Quem registrou: um adulto ou o próprio guardião. */
  recordedByGuardianId?: string | null;
  now?: string;
}

/**
 * A linha de `mission_actions` de um evento extra. Sem hora marcada: o
 * `due_at` é o instante do registro, porque o evento é o que acabou de
 * acontecer, não algo agendado.
 */
export function buildExtraActionRow(input: ExtraRowInput): Record<string, unknown> {
  const now = input.now ?? new Date().toISOString();
  const base: Record<string, unknown> = {
    mission_id: input.missionId,
    guardian_id: input.guardianId,
    action_template_id: input.template.id,
    due_at: now,
    recorded_by_guardian_id: input.recordedByGuardianId ?? null,
  };

  if (input.effect === 'tropeco') {
    return { ...base, status: 'missed', missed_at: now, confirmation_status: 'not_required' };
  }

  const done = {
    ...base,
    status: 'confirmed',
    completed_at: now,
    confirmation_status: 'not_required',
  };

  if (input.effect === 'recovery') {
    return { ...done, recovers_action_id: input.recoversActionId ?? null };
  }

  return { ...done, escalada_points_earned: escaladaPointsOf(input.template) };
}

// ============================================================
// I/O
// ============================================================

export type RegisterExtraResult =
  | { ok: true; id: string; effect: ExtraEffect; name: string }
  | {
      ok: false;
      code: 'NOT_FOUND' | 'FORBIDDEN' | 'NO_MISSION' | 'VALIDATION_ERROR' | 'DB_ERROR';
      message: string;
    };

/**
 * A falta mais recente que ainda não foi compensada por nenhuma missão
 * extra. É o que a próxima compensação vai apagar.
 */
export async function findUnrecoveredMiss(
  db: SupabaseClient,
  missionId: string,
  guardianId: string
): Promise<string | null> {
  const [{ data: misses }, { data: alreadyRecovered }] = await Promise.all([
    db
      .from('mission_actions')
      .select('id')
      .eq('mission_id', missionId)
      .eq('guardian_id', guardianId)
      .eq('status', 'missed')
      .order('missed_at', { ascending: false })
      .limit(50),
    db
      .from('mission_actions')
      .select('recovers_action_id')
      .eq('mission_id', missionId)
      .eq('guardian_id', guardianId)
      .not('recovers_action_id', 'is', null),
  ]);

  const taken = new Set((alreadyRecovered ?? []).map((r) => r.recovers_action_id));
  return (misses ?? []).find((m) => !taken.has(m.id))?.id ?? null;
}

/** Insere a linha, tolerando um banco anterior à migração 00010. */
async function insertExtraRow(
  db: SupabaseClient,
  row: Record<string, unknown>
): Promise<{ id: string } | { error: string }> {
  const attempt = await db.from('mission_actions').insert(row).select('id').single();
  if (!attempt.error) return { id: attempt.data.id as string };

  // 42703 = coluna inexistente: `recorded_by_guardian_id` chega na 00010.
  if (attempt.error.code === '42703' && 'recorded_by_guardian_id' in row) {
    const legacy = { ...row };
    delete legacy.recorded_by_guardian_id;
    const retry = await db.from('mission_actions').insert(legacy).select('id').single();
    if (!retry.error) return { id: retry.data.id as string };
    return { error: retry.error.message };
  }

  return { error: attempt.error.message };
}

export interface RegisterExtraInput {
  familyId: string;
  guardianId: string;
  templateId: string;
  kind: ExtraKind;
  /** Quem está registrando (adulto ou o próprio guardião). */
  recordedByGuardianId?: string | null;
  now?: Date;
}

/**
 * Registra um evento extra para um guardião na missão em andamento.
 * Quem chama já autenticou e autorizou — aqui valem as regras do domínio:
 * a ação precisa ser da família, do tipo escolhido, e existir missão ativa.
 */
export async function registerExtraEvent(
  db: SupabaseClient,
  input: RegisterExtraInput
): Promise<RegisterExtraResult> {
  const [{ data: template }, { data: mission }] = await Promise.all([
    db
      .from('action_templates')
      .select('id, name, category, points, escalada_base_points')
      .eq('id', input.templateId)
      .eq('family_id', input.familyId)
      .eq('is_active', true)
      .maybeSingle(),
    db
      .from('missions')
      .select('id')
      .eq('family_id', input.familyId)
      .eq('status', 'active')
      .order('start_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!template) return { ok: false, code: 'NOT_FOUND', message: 'Ação não encontrada' };
  if (!mission) {
    return { ok: false, code: 'NO_MISSION', message: 'Inicie uma missão antes de registrar eventos' };
  }

  const effect = effectOfCategory(template.category);
  if (!effect || kindOfCategory(template.category) !== input.kind) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Essa ação não é desse tipo' };
  }

  const now = (input.now ?? new Date()).toISOString();
  const recoversActionId =
    effect === 'recovery' ? await findUnrecoveredMiss(db, mission.id, input.guardianId) : null;

  const row = buildExtraActionRow({
    missionId: mission.id,
    guardianId: input.guardianId,
    template: template as ExtraTemplate,
    effect,
    recoversActionId,
    recordedByGuardianId: input.recordedByGuardianId ?? null,
    now,
  });

  const inserted = await insertExtraRow(db, row);
  if ('error' in inserted) return { ok: false, code: 'DB_ERROR', message: inserted.error };

  return { ok: true, id: inserted.id, effect, name: template.name };
}

// ============================================================
// Configuração da casa
// ============================================================

export interface ExtrasFamilySettings {
  /** Missões extras que compensam faltas. */
  recovery_enabled?: boolean | null;
  /** Escaladas: ir além do combinado. */
  escalada_enabled?: boolean | null;
}

/**
 * A casa aceita missões extras?
 *
 * As duas colunas nasceram de dois conceitos separados. Agora são um só,
 * e basta uma delas estar ligada para o registro existir — famílias
 * antigas com só uma marcada continuam valendo.
 */
export function extrasEnabled(family: ExtrasFamilySettings | null | undefined): boolean {
  if (!family) return false;
  return family.recovery_enabled !== false || family.escalada_enabled === true;
}

// ============================================================
// Casa Quest — Lib: Mark an action as done
//
// Regra compartilhada entre as duas formas de autenticação:
// o Guardião-Mor (sessão) e o guardião com link por token.
// Quem chama já autenticou e autorizou; aqui só valem as regras.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

export type MarkResult =
  | {
      ok: true;
      status: 'confirmed' | 'marked_done';
      isLate: boolean;
      needsConfirmation: boolean;
    }
  | { ok: false; code: 'NOT_FOUND' | 'FORBIDDEN' | 'ALREADY_PROCESSED' | 'INTERNAL'; message: string };

/**
 * Mark `actionId` as done on behalf of `guardianId`.
 * Verifies the action belongs to that guardian and is still pending, then
 * either auto-confirms it or moves it to "aguardando confirmação",
 * depending on the template's confirmation mode.
 */
export async function markActionDone(
  supabase: SupabaseClient,
  actionId: string,
  guardianId: string
): Promise<MarkResult> {
  const { data: action, error: actionError } = await supabase
    .from('mission_actions')
    .select('id, guardian_id, action_template_id, status, due_at')
    .eq('id', actionId)
    .single();

  if (actionError || !action) {
    return { ok: false, code: 'NOT_FOUND', message: 'Ação não encontrada' };
  }

  if (action.guardian_id !== guardianId) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: 'Esta ação não é sua',
    };
  }

  if (action.status !== 'pending') {
    return {
      ok: false,
      code: 'ALREADY_PROCESSED',
      message: 'Ação já foi processada',
    };
  }

  const now = new Date();
  const isLate = now > new Date(action.due_at);

  const { data: template } = await supabase
    .from('action_templates')
    .select('confirmation_mode')
    .eq('id', action.action_template_id)
    .single();

  const needsConfirmation = (template?.confirmation_mode || 'none') !== 'none';

  const update = needsConfirmation
    ? { status: 'marked_done', confirmation_status: 'pending' }
    : {
        status: 'confirmed',
        completed_at: now.toISOString(),
        confirmation_status: 'not_required',
      };

  const { error: updateError } = await supabase
    .from('mission_actions')
    .update(update)
    .eq('id', actionId)
    // Guard against a double submit racing past the status check above.
    .eq('status', 'pending');

  if (updateError) {
    return {
      ok: false,
      code: 'INTERNAL',
      message: `Erro ao atualizar ação: ${updateError.message}`,
    };
  }

  return {
    ok: true,
    status: needsConfirmation ? 'marked_done' : 'confirmed',
    isLate,
    needsConfirmation,
  };
}

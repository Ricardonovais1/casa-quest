// ============================================================
// Casa Quest — API: Mor decides on one action
// PATCH /api/mission-actions/[id]   { decision }
//
//   confirm  — guardião marcou "Fiz!", o Mor confirma
//   reject   — guardião marcou "Fiz!", mas não foi feita → falta
//   done     — o Mor registra como feita (pendente ou falta revertida)
//   missed   — o Mor registra como não feita
//   reopen   — volta a pendente (desfaz qualquer decisão)
// ============================================================

import { NextResponse } from 'next/server';
import { requireMor, apiError } from '@/lib/require-mor';

const DECISIONS = ['confirm', 'reject', 'done', 'missed', 'reopen'] as const;
type Decision = (typeof DECISIONS)[number];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMor();
  if (!auth.ok) return auth.response;
  const { db, mor } = auth.ctx;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { decision?: string } | null;
  const decision = body?.decision as Decision | undefined;

  if (!decision || !DECISIONS.includes(decision)) {
    return apiError('VALIDATION_ERROR', 'Decisão inválida', 400);
  }

  const { data: action } = await db
    .from('mission_actions')
    .select('id, status, due_at, guardian_id, missions!inner(family_id)')
    .eq('id', id)
    .maybeSingle();

  const rel = action?.missions as { family_id: string } | { family_id: string }[] | null | undefined;
  const familyId = Array.isArray(rel) ? rel[0]?.family_id : rel?.family_id;

  if (!action || familyId !== mor.family_id) {
    return apiError('NOT_FOUND', 'Ação não encontrada', 404);
  }

  const now = new Date().toISOString();
  let update: Record<string, unknown>;
  let confirmation: 'confirmed' | 'rejected' | null = null;

  switch (decision) {
    case 'confirm':
      if (action.status !== 'marked_done') {
        return apiError('INVALID_STATE', 'Só dá para confirmar uma ação marcada como feita', 422);
      }
      update = { status: 'confirmed', completed_at: now, missed_at: null, confirmation_status: 'confirmed' };
      confirmation = 'confirmed';
      break;
    case 'reject':
      if (action.status !== 'marked_done') {
        return apiError('INVALID_STATE', 'Só dá para rejeitar uma ação marcada como feita', 422);
      }
      update = { status: 'missed', completed_at: null, missed_at: action.due_at, confirmation_status: 'rejected' };
      confirmation = 'rejected';
      break;
    case 'done':
      update = { status: 'confirmed', completed_at: now, missed_at: null, confirmation_status: 'not_required' };
      break;
    case 'missed': {
      const missedAt = Date.parse(action.due_at) < Date.now() ? action.due_at : now;
      update = { status: 'missed', completed_at: null, missed_at: missedAt, confirmation_status: 'not_required' };
      break;
    }
    case 'reopen':
      update = { status: 'pending', completed_at: null, missed_at: null, confirmation_status: 'pending' };
      break;
  }

  const { error } = await db.from('mission_actions').update(update).eq('id', id);
  if (error) return apiError('DB_ERROR', error.message, 500);

  if (confirmation) {
    // Audit trail of who decided. Unique per (action, guardian): a repeated
    // decision just updates the previous one.
    await db
      .from('action_confirmations')
      .upsert(
        { mission_action_id: id, guardian_id: mor.id, decision: confirmation },
        { onConflict: 'mission_action_id,guardian_id' }
      );
  }

  return NextResponse.json({ data: { id, status: update.status } });
}
